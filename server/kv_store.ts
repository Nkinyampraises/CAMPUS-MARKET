import "./runtime.js";
/* Postgres-backed key-value store for app data.
 *
 * Expected table schema:
 * CREATE TABLE kv_store_50b25a4f (
 *   key TEXT PRIMARY KEY,
 *   value JSONB NOT NULL
 * );
 */

import pg from "pg";

const { Pool } = pg;

const DEFAULT_KV_TABLE = "kv_store_50b25a4f";
const LEGACY_KV_TABLE = "kv_store";
const TRANSIENT_CONNECTION_ERROR_PATTERN =
  /MaxClientsInSessionMode|too many clients|remaining connection slots|connection terminated unexpectedly|timeout acquiring a client/i;
const SERVERLESS_ENV_KEYS = [
  "VERCEL",
  "AWS_LAMBDA_FUNCTION_NAME",
  "NETLIFY",
  "RAILWAY_ENVIRONMENT",
];

let pool: InstanceType<typeof Pool> | null = null;
let resolvedKvTable: string | null = null;
let resolvingKvTable: Promise<string> | null = null;

const parseBoolean = (value: string | undefined) =>
  /^(1|true|yes|on|required)$/i.test((value || "").trim());

const sanitizeEnvValue = (value: string) =>
  value
    // Handles accidentally persisted escaped newlines (for example: "value\\r\\n")
    .replace(/\\r\\n|\\n|\\r/g, "")
    // Handles actual control characters
    .replace(/[\r\n]+/g, "")
    .trim();

const firstNonEmptyEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = sanitizeEnvValue(Deno.env.get(key) || "");
    if (value) {
      return value;
    }
  }
  return "";
};

const toSafePort = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isServerlessRuntime = () =>
  SERVERLESS_ENV_KEYS.some((key) => {
    const value = firstNonEmptyEnv(key);
    return Boolean(value) && value !== "0" && value.toLowerCase() !== "false";
  });

const isTransientConnectionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return TRANSIENT_CONNECTION_ERROR_PATTERN.test(message);
};

const resolvePoolMax = () => {
  const configured = toSafePort(firstNonEmptyEnv("POSTGRES_POOL_SIZE", "PGPOOLSIZE"), isServerlessRuntime() ? 1 : 10);
  if (!isServerlessRuntime()) {
    return configured;
  }
  // In serverless, keep per-instance pools very small to avoid exhausting Neon session limits.
  return Math.max(1, Math.min(configured, 3));
};

const quoteIdentifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return `"${value}"`;
};

const splitQualifiedName = (value: string) => {
  const normalized = value.trim();
  const parts = normalized.split(".").filter(Boolean);

  if (parts.length === 1) {
    return { schema: "public", table: parts[0] };
  }

  if (parts.length === 2) {
    return { schema: parts[0], table: parts[1] };
  }

  throw new Error(`Invalid table name: ${value}`);
};

const quoteQualifiedName = (value: string) => {
  const { schema, table } = splitQualifiedName(value);
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
};

const buildPoolConfig = () => {
  const connectionString = firstNonEmptyEnv(
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
    "POSTGRES_CONNECTION_STRING",
  );

  const sslEnabled =
    parseBoolean(firstNonEmptyEnv("POSTGRES_SSL", "PGSSLMODE")) ||
    /sslmode=require|ssl=true/i.test(connectionString);
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined;
  const sharedPoolOptions = {
    max: resolvePoolMax(),
    idleTimeoutMillis: toSafePort(firstNonEmptyEnv("POSTGRES_IDLE_TIMEOUT_MS"), 10_000),
    connectionTimeoutMillis: toSafePort(firstNonEmptyEnv("POSTGRES_CONNECT_TIMEOUT_MS"), 5_000),
    // Helps serverless functions release idle clients between invocations.
    allowExitOnIdle: true,
  };

  if (connectionString) {
    return {
      connectionString,
      ssl,
      ...sharedPoolOptions,
    };
  }

  const host = firstNonEmptyEnv("POSTGRES_HOST", "PGHOST");
  const user = firstNonEmptyEnv("POSTGRES_USER", "PGUSER");
  const password = firstNonEmptyEnv("POSTGRES_PASSWORD", "PGPASSWORD");
  const database = firstNonEmptyEnv("POSTGRES_DATABASE", "PGDATABASE");

  if (!host || !user || !database) {
    throw new Error(
      "Missing Postgres configuration. Set DATABASE_URL or POSTGRES_HOST/POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DATABASE.",
    );
  }

  return {
    host,
    port: toSafePort(firstNonEmptyEnv("POSTGRES_PORT", "PGPORT"), 5432),
    user,
    password,
    database,
    ssl,
    ...sharedPoolOptions,
  };
};

const getPool = () => {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
  }

  return pool;
};

const getClientWithRetry = async () => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await getPool().connect();
    } catch (error) {
      const canRetry = attempt < 2 && isTransientConnectionError(error);
      if (!canRetry) {
        throw error;
      }
      await delay(120 * (attempt + 1));
    }
  }
};

const getKvTableCandidates = () => {
  const configured = (Deno.env.get("KV_STORE_TABLE") || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set([
    ...configured,
    DEFAULT_KV_TABLE,
    LEGACY_KV_TABLE,
  ]));
};

async function query<T = any>(text: string, params: unknown[] = []) {
  for (let attempt = 0; ; attempt += 1) {
    const client = await getClientWithRetry();

    try {
      return await client.query<T>(text, params);
    } catch (error) {
      const canRetry = attempt < 2 && isTransientConnectionError(error);
      if (!canRetry) {
        throw error;
      }
      await delay(120 * (attempt + 1));
    } finally {
      client.release();
    }
  }
}

async function ensureKvTable(tableName: string) {
  const { schema } = splitQualifiedName(tableName);

  if (schema !== "public") {
    await query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)}`);
  }

  await query(
    `CREATE TABLE IF NOT EXISTS ${quoteQualifiedName(tableName)} (
      key TEXT NOT NULL PRIMARY KEY,
      value JSONB NOT NULL
    )`,
  );
}

async function resolveKvTableName() {
  if (resolvedKvTable) {
    return resolvedKvTable;
  }

  if (!resolvingKvTable) {
    resolvingKvTable = (async () => {
      const candidates = getKvTableCandidates();

      for (const tableName of candidates) {
        const result = await query<{ regclass: string | null }>(
          "SELECT to_regclass($1) AS regclass",
          [tableName],
        );

        if (result.rows[0]?.regclass) {
          resolvedKvTable = tableName;
          return tableName;
        }
      }

      const fallbackTable = candidates[0];
      await ensureKvTable(fallbackTable);
      resolvedKvTable = fallbackTable;
      return fallbackTable;
    })().finally(() => {
      resolvingKvTable = null;
    });
  }

  return await resolvingKvTable;
}

const stringifyValue = (value: unknown) => JSON.stringify(value ?? null);

// Set stores a key-value pair in the database.
export const set = async (key: string, value: any): Promise<void> => {
  try {
    const table = await resolveKvTableName();

    await query(
      `INSERT INTO ${quoteQualifiedName(table)} (key, value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value`,
      [key, stringifyValue(value)],
    );
  } catch (error) {
    console.error('KV store set error:', error);
  }
};

// Get retrieves a key-value pair from the database.
export const get = async (key: string): Promise<any> => {
  try {
    const table = await resolveKvTableName();
    const result = await query<{ value: any }>(
      `SELECT value
       FROM ${quoteQualifiedName(table)}
       WHERE key = $1
       LIMIT 1`,
      [key],
    );

    return result.rows[0]?.value;
  } catch (error) {
    console.error('KV store get error:', error);
    return null;
  }
};

// Delete deletes a key-value pair from the database.
export const del = async (key: string): Promise<void> => {
  try {
    const table = await resolveKvTableName();

    await query(
      `DELETE FROM ${quoteQualifiedName(table)}
       WHERE key = $1`,
      [key],
    );
  } catch (error) {
    console.error('KV store del error:', error);
  }
};

// Sets multiple key-value pairs in the database.
export const mset = async (keys: string[], values: any[]): Promise<void> => {
  if (keys.length !== values.length) {
    throw new Error("mset expects keys and values to have the same length");
  }

  if (keys.length === 0) {
    return;
  }

  try {
    const table = await resolveKvTableName();
    const client = await getClientWithRetry();

    try {
      await client.query("BEGIN");

      for (let index = 0; index < keys.length; index += 1) {
        await client.query(
          `INSERT INTO ${quoteQualifiedName(table)} (key, value)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value`,
          [keys[index], stringifyValue(values[index])],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('KV store mset error:', error);
  }
};

// Gets multiple key-value pairs from the database.
export const mget = async (keys: string[]): Promise<any[]> => {
  if (keys.length === 0) {
    return [];
  }

  try {
    const table = await resolveKvTableName();
    const result = await query<{ key: string; value: any }>(
      `SELECT key, value
       FROM ${quoteQualifiedName(table)}
       WHERE key = ANY($1::text[])`,
      [keys],
    );

    const valuesByKey = new Map(
      result.rows.map((row: { key: string; value: any }) => [row.key, row.value] as const),
    );
    return keys
      .map((key) => valuesByKey.get(key))
      .filter((value) => typeof value !== "undefined");
  } catch (error) {
    console.error('KV store mget error:', error);
    return [];
  }
};

// Deletes multiple key-value pairs from the database.
export const mdel = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) {
    return;
  }

  try {
    const table = await resolveKvTableName();

    await query(
      `DELETE FROM ${quoteQualifiedName(table)}
       WHERE key = ANY($1::text[])`,
      [keys],
    );
  } catch (error) {
    console.error('KV store mdel error:', error);
  }
};

// Search for key-value pairs by prefix.
export const getByPrefix = async (prefix: string): Promise<any[]> => {
  try {
    const table = await resolveKvTableName();
    const result = await query<{ value: any }>(
      `SELECT value
       FROM ${quoteQualifiedName(table)}
       WHERE key LIKE $1
       ORDER BY key ASC`,
      [`${prefix}%`],
    );

    return result.rows.map((row: { value: any }) => row.value);
  } catch (error) {
    console.error('KV store getByPrefix error:', error);
    return [];
  }
};
