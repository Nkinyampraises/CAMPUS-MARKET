import { Buffer } from "node:buffer";
import * as kv from "./kv_store.tsx";

type AuthIdentity = {
  id: string;
  email?: string;
};

type UserAuthRecord = {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt: string;
};

type RefreshTokenRecord = {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
};

type ResetTokenRecord = {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

const ACCESS_TOKEN_TTL_SECONDS = toSafeNumber(
  firstNonEmptyEnv("ACCESS_TOKEN_TTL_SECONDS", "AUTH_ACCESS_TOKEN_TTL_SECONDS"),
  60 * 60 * 8,
);
const REFRESH_TOKEN_TTL_SECONDS = toSafeNumber(
  firstNonEmptyEnv("REFRESH_TOKEN_TTL_SECONDS", "AUTH_REFRESH_TOKEN_TTL_SECONDS"),
  60 * 60 * 24 * 30,
);
const RESET_TOKEN_TTL_SECONDS = toSafeNumber(
  firstNonEmptyEnv("PASSWORD_RESET_TOKEN_TTL_SECONDS", "AUTH_RESET_TOKEN_TTL_SECONDS"),
  60 * 30,
);
const PASSWORD_HASH_ITERATIONS = toSafeNumber(
  firstNonEmptyEnv("PASSWORD_HASH_ITERATIONS"),
  310000,
);
const PASSWORD_HASH_PREFIX = "pbkdf2_sha256";

let hmacKeyPromise: Promise<CryptoKey> | null = null;

function firstNonEmptyEnv(...keys: string[]) {
  for (const key of keys) {
    const value = (Deno.env.get(key) || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function toSafeNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAuthSecret() {
  const secret = firstNonEmptyEnv("JWT_SECRET", "AUTH_SECRET", "WEBHOOK_SECRET", "ADMIN_PASSWORD");
  if (!secret) {
    throw new Error("Missing JWT_SECRET or AUTH_SECRET environment variable");
  }
  return secret;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function userAuthKey(userId: string) {
  return `auth:user:${userId}`;
}

function userEmailKey(email: string) {
  return `auth:email:${normalizeEmail(email)}`;
}

function refreshTokenKey(token: string) {
  return `auth:refresh:${token}`;
}

function resetTokenKey(token: string) {
  return `auth:reset:${token}`;
}

function userRefreshListKey(userId: string) {
  return `auth:user:${userId}:refreshTokens`;
}

function userResetListKey(userId: string) {
  return `auth:user:${userId}:resetTokens`;
}

function isUserProfileRecord(value: any): value is { id: string; email: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.id === "string" &&
      typeof value.email === "string",
  );
}

function extractLegacyPasswordHash(profile: any): string | null {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }

  if (typeof profile.passwordHash === "string" && profile.passwordHash.trim()) {
    return profile.passwordHash.trim();
  }

  if (typeof profile.password_hash === "string" && profile.password_hash.trim()) {
    return profile.password_hash.trim();
  }

  if (
    profile.auth &&
    typeof profile.auth === "object" &&
    !Array.isArray(profile.auth) &&
    typeof profile.auth.passwordHash === "string" &&
    profile.auth.passwordHash.trim()
  ) {
    return profile.auth.passwordHash.trim();
  }

  return null;
}

function createRandomToken(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${prefix}_${Buffer.from(bytes).toString("base64url")}`;
}

async function getHmacKey() {
  if (!hmacKeyPromise) {
    hmacKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getAuthSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }

  return await hmacKeyPromise;
}

function toBase64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fromBase64UrlJson<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    const leftByte = index < left.length ? left[index] : 0;
    const rightByte = index < right.length ? right[index] : 0;
    mismatch |= leftByte ^ rightByte;
  }

  return mismatch === 0;
}

async function signAccessToken(payload: Record<string, unknown>) {
  const headerSegment = toBase64UrlJson({ alg: "HS256", typ: "JWT" });
  const payloadSegment = toBase64UrlJson(payload);
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getHmacKey(),
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

async function verifyAccessToken(token: string) {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;
  const signatureBytes = Buffer.from(signatureSegment, "base64url");
  const signingInput = `${headerSegment}.${payloadSegment}`;

  const isValid = await crypto.subtle.verify(
    "HMAC",
    await getHmacKey(),
    signatureBytes,
    new TextEncoder().encode(signingInput),
  );

  if (!isValid) {
    return null;
  }

  const payload = fromBase64UrlJson<Record<string, unknown>>(payloadSegment);
  if (!payload || payload.type !== "access" || typeof payload.sub !== "string") {
    return null;
  }

  const expiresAt = Number(payload.exp);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

async function derivePasswordHash(password: string, salt: string, iterations: number) {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: Buffer.from(salt, "base64url"),
      iterations,
      hash: "SHA-256",
    },
    importedKey,
    256,
  );

  return Buffer.from(derivedBits).toString("base64url");
}

async function addTokenToUserList(listKey: string, token: string) {
  const existing = (await kv.get(listKey)) || [];
  const next = Array.isArray(existing) ? existing.filter((entry) => typeof entry === "string") : [];

  if (!next.includes(token)) {
    next.push(token);
    await kv.set(listKey, next);
  }
}

async function removeTokenFromUserList(listKey: string, token: string) {
  const existing = (await kv.get(listKey)) || [];
  if (!Array.isArray(existing)) {
    return;
  }

  const next = existing.filter((entry) => entry !== token);
  await kv.set(listKey, next);
}

export async function hashPassword(password: string) {
  const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
  const derivedHash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${salt}$${derivedHash}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [prefix, iterationsValue, salt, expectedHash] = storedHash.split("$");

  if (!prefix || !iterationsValue || !salt || !expectedHash) {
    return false;
  }

  if (prefix !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const iterations = toSafeNumber(iterationsValue, 0);
  if (!iterations) {
    return false;
  }

  const derivedHash = await derivePasswordHash(password, salt, iterations);
  return constantTimeEqual(
    Buffer.from(derivedHash, "utf8"),
    Buffer.from(expectedHash, "utf8"),
  );
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const indexedUserId = await kv.get(userEmailKey(normalizedEmail));
  if (typeof indexedUserId === "string" && indexedUserId.trim()) {
    const indexedProfile = await kv.get(`user:${indexedUserId}`);
    if (isUserProfileRecord(indexedProfile) && normalizeEmail(indexedProfile.email) === normalizedEmail) {
      return indexedProfile;
    }
  }

  const users = (await kv.getByPrefix("user:")) || [];
  for (const candidate of users) {
    if (!isUserProfileRecord(candidate)) {
      continue;
    }

    if (normalizeEmail(candidate.email) === normalizedEmail) {
      await kv.set(userEmailKey(normalizedEmail), candidate.id);
      return candidate;
    }
  }

  return null;
}

export async function getUserAuthRecord(userId: string, profile?: any): Promise<UserAuthRecord | null> {
  const existingRecord = await kv.get(userAuthKey(userId));
  if (
    existingRecord &&
    typeof existingRecord === "object" &&
    !Array.isArray(existingRecord) &&
    typeof existingRecord.passwordHash === "string"
  ) {
    return existingRecord as UserAuthRecord;
  }

  const sourceProfile = profile || (await kv.get(`user:${userId}`));
  const legacyPasswordHash = extractLegacyPasswordHash(sourceProfile);

  if (!legacyPasswordHash || !sourceProfile || typeof sourceProfile.email !== "string") {
    return null;
  }

  const now = new Date().toISOString();
  const migratedRecord: UserAuthRecord = {
    userId,
    email: normalizeEmail(sourceProfile.email),
    passwordHash: legacyPasswordHash,
    createdAt: typeof sourceProfile.createdAt === "string" ? sourceProfile.createdAt : now,
    updatedAt: now,
    passwordUpdatedAt: now,
  };

  await kv.set(userAuthKey(userId), migratedRecord);
  await kv.set(userEmailKey(sourceProfile.email), userId);
  return migratedRecord;
}

export async function setUserPassword(userId: string, email: string, password: string) {
  const existingRecord = await getUserAuthRecord(userId);
  const now = new Date().toISOString();
  const nextRecord: UserAuthRecord = {
    userId,
    email: normalizeEmail(email),
    passwordHash: await hashPassword(password),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    passwordUpdatedAt: now,
  };

  await kv.set(userAuthKey(userId), nextRecord);
  await kv.set(userEmailKey(email), userId);
  return nextRecord;
}

export async function issueSession(user: AuthIdentity) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email || "",
    type: "access",
    iat: nowInSeconds,
    exp: nowInSeconds + ACCESS_TOKEN_TTL_SECONDS,
  });

  const refreshToken = createRandomToken("rt");
  const refreshTokenRecord: RefreshTokenRecord = {
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  await kv.set(refreshTokenKey(refreshToken), refreshTokenRecord);
  await addTokenToUserList(userRefreshListKey(user.id), refreshToken);

  return { accessToken, refreshToken };
}

export async function refreshSession(refreshToken: string) {
  const record = await kv.get(refreshTokenKey(refreshToken));
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    typeof record.userId !== "string" ||
    typeof record.expiresAt !== "string"
  ) {
    return null;
  }

  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await kv.del(refreshTokenKey(refreshToken));
    await removeTokenFromUserList(userRefreshListKey(record.userId), refreshToken);
    return null;
  }

  const profile = await kv.get(`user:${record.userId}`);
  if (!isUserProfileRecord(profile)) {
    await kv.del(refreshTokenKey(refreshToken));
    await removeTokenFromUserList(userRefreshListKey(record.userId), refreshToken);
    return null;
  }

  await kv.del(refreshTokenKey(refreshToken));
  await removeTokenFromUserList(userRefreshListKey(record.userId), refreshToken);
  return await issueSession({ id: record.userId, email: profile.email });
}

export async function revokeUserSessions(userId: string) {
  const refreshTokens = (await kv.get(userRefreshListKey(userId))) || [];
  if (Array.isArray(refreshTokens)) {
    for (const token of refreshTokens) {
      if (typeof token === "string" && token.trim()) {
        await kv.del(refreshTokenKey(token));
      }
    }
  }

  await kv.set(userRefreshListKey(userId), []);
}

export async function createPasswordResetToken(userId: string, email: string) {
  const token = createRandomToken("reset");
  const record: ResetTokenRecord = {
    token,
    userId,
    email: normalizeEmail(email),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  await kv.set(resetTokenKey(token), record);
  await addTokenToUserList(userResetListKey(userId), token);
  return token;
}

export async function consumePasswordResetToken(token: string) {
  const record = await kv.get(resetTokenKey(token));
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    typeof record.userId !== "string" ||
    typeof record.expiresAt !== "string"
  ) {
    return null;
  }

  const expiresAt = Date.parse(record.expiresAt);
  await kv.del(resetTokenKey(token));
  await removeTokenFromUserList(userResetListKey(record.userId), token);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return record as ResetTokenRecord;
}

export async function deleteUserAuthArtifacts(userId: string, email?: string) {
  await revokeUserSessions(userId);

  const resetTokens = (await kv.get(userResetListKey(userId))) || [];
  if (Array.isArray(resetTokens)) {
    for (const token of resetTokens) {
      if (typeof token === "string" && token.trim()) {
        await kv.del(resetTokenKey(token));
      }
    }
  }

  await kv.del(userResetListKey(userId));
  await kv.del(userRefreshListKey(userId));
  await kv.del(userAuthKey(userId));

  if (email) {
    await kv.del(userEmailKey(email));
  }
}

export async function verifyAuthHeader(authHeader: string | null | undefined) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return null;
  }

  return {
    id: payload.sub as string,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}
