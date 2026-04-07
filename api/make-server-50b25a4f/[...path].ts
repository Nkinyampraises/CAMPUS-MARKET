import type { VercelRequest, VercelResponse } from "@vercel/node";
import pg from "pg";

const { Pool } = pg;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

let pool: InstanceType<typeof Pool> | null = null;

const getPool = () => {
  if (!pool) {
    const connectionString = String(process.env.DATABASE_URL || "").trim();
    if (!connectionString) {
      throw new Error("Missing DATABASE_URL");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
};

const extractPathSegments = (req: VercelRequest): string[] => {
  const raw = req.query.path;
  if (Array.isArray(raw)) {
    return raw.map((part) => String(part || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split("/").map((part) => part.trim()).filter(Boolean);
  }
  return [];
};

const sendJson = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status);
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
};

const queryRows = async <T = any>(sql: string, params: unknown[] = []) => {
  const client = await getPool().connect();
  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
};

const getByKey = async (key: string) => {
  const rows = await queryRows<{ value: any }>(
    "SELECT value FROM kv_store_50b25a4f WHERE key = $1 LIMIT 1",
    [key],
  );
  return rows[0]?.value ?? null;
};

const getByPrefix = async (prefix: string) => {
  const rows = await queryRows<{ value: any }>(
    "SELECT value FROM kv_store_50b25a4f WHERE key LIKE $1 ORDER BY key",
    [`${prefix}%`],
  );
  return rows.map((row) => row.value).filter(Boolean);
};

const normalizeNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const enrichListings = async (listings: any[]) => {
  const safeListings = listings.filter((entry) => entry && typeof entry === "object");
  const sellerIds = Array.from(
    new Set(
      safeListings
        .map((entry) => String(entry.sellerId || "").trim())
        .filter(Boolean),
    ),
  );

  const sellers = new Map<string, any>();
  if (sellerIds.length > 0) {
    const sellerKeys = sellerIds.map((id) => `user:${id}`);
    const rows = await queryRows<{ key: string; value: any }>(
      "SELECT key, value FROM kv_store_50b25a4f WHERE key = ANY($1::text[])",
      [sellerKeys],
    );
    for (const row of rows) {
      const user = row.value;
      if (!user || typeof user !== "object") continue;
      const userId = String(user.id || "").trim();
      if (!userId) continue;
      sellers.set(userId, {
        id: userId,
        name: user.name || "Unknown Seller",
        email: user.email || "",
        phone: user.phone || "",
        rating: normalizeNumber(user.rating, 0),
        reviewCount: normalizeNumber(user.reviewCount, 0),
        isVerified: Boolean(user.isVerified),
        university: user.university || "",
        profilePicture: user.profilePicture || "",
      });
    }
  }

  return safeListings.map((listing) => {
    const sellerId = String(listing.sellerId || "").trim();
    return {
      ...listing,
      views: Math.max(0, Math.floor(normalizeNumber(listing.views, 0))),
      likesCount: Math.max(0, Math.floor(normalizeNumber(listing.likesCount, 0))),
      seller: sellers.get(sellerId) || undefined,
    };
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    res.status(204).send("");
    return;
  }

  try {
    const segments = extractPathSegments(req);
    const method = String(req.method || "GET").toUpperCase();

    if (method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    if (segments.length === 0 || (segments.length === 1 && segments[0] === "health")) {
      sendJson(res, 200, {
        status: "ok",
        database: "postgres",
        auth: "postgres",
        storage: "postgres",
        email: "disabled",
      });
      return;
    }

    if (segments.length === 1 && segments[0] === "universities") {
      const universities = await getByKey("admin:universities");
      sendJson(res, 200, { universities: Array.isArray(universities) ? universities : [] });
      return;
    }

    if (segments.length === 1 && segments[0] === "categories") {
      const categories = await getByKey("admin:categories");
      sendJson(res, 200, { categories: Array.isArray(categories) ? categories : [] });
      return;
    }

    if (segments[0] === "listings") {
      if (segments.length === 1) {
        const listings = await getByPrefix("listing:");
        const enriched = await enrichListings(listings);
        sendJson(res, 200, { listings: enriched });
        return;
      }

      if (segments.length === 2) {
        const listingId = segments[1];
        const listing = await getByKey(`listing:${listingId}`);
        if (!listing) {
          sendJson(res, 404, { error: "Listing not found" });
          return;
        }
        const [enriched] = await enrichListings([listing]);
        sendJson(res, 200, { listing: enriched || listing });
        return;
      }
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error: any) {
    sendJson(res, 500, {
      error: "Server error",
      details: String(error?.message || error || "unknown"),
    });
  }
}
