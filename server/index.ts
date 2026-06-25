import "./runtime.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Buffer } from "node:buffer";
import * as kv from "./kv_store.js";
import {
  isEmailDeliveryConfigured,
  sendAccountConfirmationEmail,
  sendEmailVerificationCodeEmail,
  sendPasswordResetEmail,
  sendTwoFactorCodeEmail,
} from "./mail.js";

const app = new Hono();

const frontendUrl = (Deno.env.get('FRONTEND_URL') || Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_SITE_URL') || '').trim();

const isLocalHostValue = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("0.0.0.0")
  );
};

const resolveFrontendBase = (req: Request) => {
  const forwardedHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').trim();

  if (frontendUrl) {
    // Protect production emails from localhost links when env is left in local mode.
    if (!(isLocalHostValue(frontendUrl) && forwardedHost && !isLocalHostValue(forwardedHost))) {
      return frontendUrl.replace(/\/+$/, '');
    }
  }

  const origin = req.headers.get('origin');
  if (origin) {
    return origin.replace(/\/+$/, '');
  }

  if (!forwardedHost) {
    return undefined;
  }

  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
};

const resolveFrontendRedirectTo = (req: Request, path: string) => {
  const base = resolveFrontendBase(req);
  if (!base) {
    return undefined;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-ai-guest-id", "x-refresh-token", "x-device-id"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

function normalizeUserProfile(profile: any) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return null;
  }

  const normalized = { ...profile };
  const hasValidUserType = normalized.userType === 'buyer' || normalized.userType === 'seller';

  if (!normalized.createdAt) {
    normalized.createdAt = new Date().toISOString();
  }

  normalized.userType = hasValidUserType
    ? normalized.userType
    : (normalized.role === 'admin' ? 'seller' : 'buyer');

  const rawPicture = typeof normalized.profilePicture === 'string' ? normalized.profilePicture : (typeof normalized.avatar === 'string' ? normalized.avatar : '');
  const profilePicture = isLegacyUnavailableUrl(rawPicture) ? '' : rawPicture;
  normalized.profilePicture = profilePicture;
  normalized.avatar = profilePicture;
  normalized.isBanned = typeof normalized.isBanned === 'boolean' ? normalized.isBanned : false;

  return normalized;
}

const AUTH_PROVIDER = "postgres";
const STORAGE_PROVIDER = "postgres";
const textEncoder = new TextEncoder();
const readEnvNumber = (key: string, fallback: number) => {
  const str = (Deno.env.get(key) || "").trim();
  if (!str) return fallback;
  const raw = Number(str);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};
const PASSWORD_HASH_ITERATIONS = Math.max(100_000, readEnvNumber("PASSWORD_HASH_ITERATIONS", 120_000));
const ACCESS_TOKEN_TTL_MS = Math.max(60_000, readEnvNumber("ACCESS_TOKEN_TTL_MS", 1000 * 60 * 60 * 12));
const REFRESH_TOKEN_TTL_MS = Math.max(300_000, readEnvNumber("REFRESH_TOKEN_TTL_MS", 1000 * 60 * 60 * 24 * 30));
const PASSWORD_RESET_TTL_MS = Math.max(300_000, readEnvNumber("PASSWORD_RESET_TTL_MS", 1000 * 60 * 30));
const EMAIL_CONFIRMATION_TTL_MS = Math.max(300_000, readEnvNumber("EMAIL_CONFIRMATION_TTL_MS", 1000 * 60 * 60 * 24));
const TWO_FACTOR_TTL_MS = Math.max(120_000, readEnvNumber("TWO_FACTOR_TTL_MS", 1000 * 60 * 10));
const TWO_FACTOR_RESEND_COOLDOWN_MS = Math.max(15_000, readEnvNumber("TWO_FACTOR_RESEND_COOLDOWN_MS", 1000 * 60));
const TWO_FACTOR_MAX_ATTEMPTS = Math.max(3, readEnvNumber("TWO_FACTOR_MAX_ATTEMPTS", 5));
const TWO_FACTOR_MAX_RESENDS = Math.max(1, readEnvNumber("TWO_FACTOR_MAX_RESENDS", 5));
// 6-digit signup email verification code TTL (default 15 min) and how long a
// "remember this device" trust lasts before a new-device challenge is required again.
const EMAIL_VERIFICATION_CODE_TTL_MS = Math.max(120_000, readEnvNumber("EMAIL_VERIFICATION_CODE_TTL_MS", 1000 * 60 * 15));
const TRUSTED_DEVICE_TTL_MS = Math.max(60_000, readEnvNumber("TRUSTED_DEVICE_TTL_MS", 1000 * 60 * 60 * 24 * 30));
// Email verification method for new signups: "code" (6-digit, default) or "link".
const EMAIL_VERIFICATION_METHOD = (
  (Deno.env.get("AUTH_EMAIL_VERIFICATION_METHOD") || "code").trim().toLowerCase() === "link" ? "link" : "code"
);
// Two-factor is OPT-IN: disabled by default, enabled per-user from Settings.
// Set AUTH_REQUIRE_TWO_FACTOR=true to force an email-code challenge for everyone.
const requireTwoFactorByDefault = /^(1|true|yes|on)$/i.test(
  (Deno.env.get("AUTH_REQUIRE_TWO_FACTOR") || "false").trim(),
);
// New-device email challenge is OFF by default so normal login is just
// email + password. Set AUTH_CHALLENGE_NEW_DEVICE=true to require an emailed
// code the first time an account signs in from an unrecognized device/browser.
const challengeNewDevices = /^(1|true|yes|on)$/i.test(
  (Deno.env.get("AUTH_CHALLENGE_NEW_DEVICE") || "false").trim(),
);
// When true, the 6-digit 2FA code is also returned in the API response (and shown
// on the login screen) so sign-in never depends on email delivery. Intended for
// local/demo use only — keep it OFF (false) in any real deployment.
const twoFactorDevReveal = /^(1|true|yes|on)$/i.test(
  (Deno.env.get("TWO_FACTOR_DEV_REVEAL") || "").trim(),
);

// ── JWT helpers ─────────────────────────────────────────────────────────────
// Access tokens are self-contained JWTs signed with JWT_SECRET.
// Validation requires NO database lookup — the signature is verified
// cryptographically. This eliminates the "401 on every request" problem
// caused by intermittent Supabase connection-pool failures.
const JWT_SECRET = (Deno.env.get("JWT_SECRET") || "").trim();
const JWT_ENABLED = JWT_SECRET.length >= 32;

const b64url = (buf: ArrayBuffer) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlStr = (s: string) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();

async function signJwtToken(userId: string, email: string, expiresAt: string): Promise<string> {
  const header = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64urlStr(JSON.stringify({ sub: userId, email, exp: Math.floor(new Date(expiresAt).getTime() / 1000), typ: "access" }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

async function verifyJwtToken(token: string): Promise<{ userId: string; email: string; expiresAt: string } | null> {
  if (!JWT_ENABLED) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64"), new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return null;
    const data = JSON.parse(fromB64url(payload));
    if (data.typ !== "access" || !data.sub || !data.email) return null;
    if (data.exp && Date.now() / 1000 > data.exp) return null;
    return { userId: data.sub, email: data.email, expiresAt: new Date(data.exp * 1000).toISOString() };
  } catch {
    return null;
  }
}
// ────────────────────────────────────────────────────────────────────────────
// Default ON — new signups must verify their email before they can sign in.
// Existing accounts created before this flag was on were auto-verified
// (emailVerified: true) and are unaffected. Set AUTH_REQUIRE_EMAIL_CONFIRMATION=false
// to disable email gating entirely (e.g. local/demo).
const requireEmailConfirmation = !/^(0|false|no|off)$/i.test(
  (Deno.env.get("AUTH_REQUIRE_EMAIL_CONFIRMATION") || "true").trim(),
);
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const NOTCHPAY_PUBLIC_KEY = (Deno.env.get("NOTCHPAY_PUBLIC_KEY") || "").trim();
const NOTCHPAY_HASH_KEY   = (Deno.env.get("NOTCHPAY_HASH_KEY")   || "").trim();
const NOTCHPAY_API_URL    = "https://api.notchpay.co";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/jfif", "image/pjpeg"]);
const FILE_ROUTE_PREFIX = "/make-server-50b25a4f/files";
const OPENAI_API_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
const OPENAI_BASE_URL = (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").trim().replace(/\/$/, "");
const OPENAI_CHAT_MODEL = (Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-4.1-mini").trim();
const OPENAI_TRANSCRIBE_MODEL = (Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-mini-transcribe").trim();
const GEMINI_API_KEY = (Deno.env.get("GEMINI_API_KEY") || "").trim();
const GEMINI_CHAT_MODEL = (Deno.env.get("GEMINI_CHAT_MODEL") || "gemini-2.0-flash").trim();
const HUGGING_FACE_API_KEY = (
  Deno.env.get("HUGGING_FACE_API_KEY") ||
  Deno.env.get("HUGGINGFACE_API_KEY") ||
  Deno.env.get("HF_TOKEN") ||
  ""
).trim();
const HUGGING_FACE_MODEL = (
  Deno.env.get("HUGGING_FACE_MODEL") ||
  Deno.env.get("HUGGINGFACE_MODEL") ||
  "Qwen/Qwen2.5-7B-Instruct"
).trim();
const AI_PROVIDER = (Deno.env.get("AI_PROVIDER") || "openai").trim().toLowerCase();
const AI_CHAT_HISTORY_LIMIT = Math.max(20, readEnvNumber("AI_CHAT_HISTORY_LIMIT", 80));
const AI_CHAT_CONVERSATION_LIMIT = Math.max(5, readEnvNumber("AI_CHAT_CONVERSATION_LIMIT", 30));
const AI_MAX_PROMPT_LISTINGS = Math.max(10, readEnvNumber("AI_MAX_PROMPT_LISTINGS", 50));
const AI_MAX_USER_IMAGES = 3;
const AI_CHAT_DAILY_LIMIT = Math.max(1, readEnvNumber("AI_CHAT_DAILY_LIMIT", 9999));
const AI_CHAT_LIMIT_WINDOW_MS = Math.max(
  60_000,
  readEnvNumber("AI_CHAT_LIMIT_WINDOW_MS", 24 * 60 * 60 * 1000),
);
const AI_DAILY_LIMIT_TIMEZONE = (Deno.env.get("AI_DAILY_LIMIT_TIMEZONE") || "Africa/Lagos").trim() || "Africa/Lagos";

const normalizeEmail = (value: any) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const sanitizeFileName = (value: any) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  const safe = normalized.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe || "upload";
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hexToBytes = (value: string) => {
  const normalized = value.trim();
  if (!normalized || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex value");
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
};

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
};

const createRandomToken = (size = 32) => {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return bytesToHex(bytes);
};

const authUserKey = (userId: string) => `auth:user:${userId}`;
const authEmailKey = (email: string) => `auth:email:${encodeURIComponent(email)}`;
const authAccessKey = (token: string) => `auth:access:${token}`;
const authRefreshKey = (token: string) => `auth:refresh:${token}`;
const authPasswordResetKey = (tokenHash: string) => `auth:password-reset:${tokenHash}`;
const authEmailConfirmationKey = (tokenHash: string) => `auth:email-confirm:${tokenHash}`;
const authTwoFactorSessionKey = (tokenHash: string) => `auth:two-factor:${tokenHash}`;
const authUserTwoFactorSessionKey = (userId: string) => `auth:user:${userId}:two-factor`;
const authEmailVerifyCodeKey = (userId: string) => `auth:email-verify-code:${userId}`;
const authTrustedDevicesKey = (userId: string) => `auth:user:${userId}:trusted-devices`;
const authStepUpKey = (tokenHash: string) => `auth:step-up:${tokenHash}`;
const storedFileKey = (fileId: string) => `file:${fileId}`;
const aiChatHistoryKey = (userId: string) => `user:${userId}:ai-chat-history`;
const aiChatConversationsKey = (userId: string) => `user:${userId}:ai-chat-conversations`;
const aiPreferenceKey = (userId: string) => `user:${userId}:ai-preferences`;
const aiAnalyticsKey = (userId: string) => `user:${userId}:ai-analytics`;
const aiDailyUsageKey = (subjectId: string) =>
  `ai:daily-usage:${encodeURIComponent(subjectId)}`;

const resolveRequestOrigin = (req: Request) => {
  const requestUrl = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!forwardedHost) {
    return requestUrl.origin;
  }

  const forwardedProto = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(/:$/, "");
  return `${forwardedProto}://${forwardedHost}`;
};

const buildStoredFileUrl = (req: Request, fileId: string) =>
  `${resolveRequestOrigin(req)}${FILE_ROUTE_PREFIX}/${encodeURIComponent(fileId)}`;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

// ── TOTP (RFC 6238) — dependency-free, built on WebCrypto HMAC-SHA1 ──────────
// Authenticator apps (Google Authenticator, Authy, Microsoft Authenticator) use
// 6-digit, 30-second, SHA-1 TOTP. We implement it directly to avoid adding an
// npm dependency, matching the project's existing hand-rolled crypto style.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;

const base32Encode = (bytes: Uint8Array) => {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let index = 0; index < bytes.length; index += 1) {
    value = (value << 8) | bytes[index];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const base32Decode = (input: string) => {
  const cleaned = String(input || "").replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      continue;
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
};

const generateTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

async function hotpCode(secretBytes: Uint8Array<ArrayBuffer>, counter: number, digits = 6) {
  const counterBytes = new Uint8Array(8);
  let remaining = counter;
  for (let index = 7; index >= 0; index -= 1) {
    counterBytes[index] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

async function verifyTotpCode(secretBase32: string, code: string, window = 1) {
  const normalized = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const secretBytes = base32Decode(secretBase32);
  if (!secretBytes.length) {
    return false;
  }

  const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    const candidate = await hotpCode(secretBytes, counter + errorWindow);
    if (timingSafeEqual(candidate, normalized)) {
      return true;
    }
  }
  return false;
}

const buildOtpauthUri = (secretBase32: string, accountEmail: string, issuer: string) => {
  const safeIssuer = issuer || "Campus Market";
  const label = encodeURIComponent(`${safeIssuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: safeIssuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

// ── AES-GCM encryption for TOTP secrets at rest ──────────────────────────────
// The shared key is derived (SHA-256) from TWO_FACTOR_ENC_KEY, falling back to
// JWT_SECRET / AUTH_SECRET so existing deployments keep working.
const TWO_FACTOR_ENC_SECRET = (
  Deno.env.get("TWO_FACTOR_ENC_KEY") ||
  JWT_SECRET ||
  Deno.env.get("AUTH_SECRET") ||
  ""
).trim();
let twoFactorEncKeyPromise: Promise<CryptoKey> | null = null;

async function getTwoFactorEncKey() {
  if (!TWO_FACTOR_ENC_SECRET) {
    throw new Error("Missing TWO_FACTOR_ENC_KEY/JWT_SECRET for 2FA secret encryption");
  }
  if (!twoFactorEncKeyPromise) {
    twoFactorEncKeyPromise = (async () => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        textEncoder.encode(`2fa:${TWO_FACTOR_ENC_SECRET}`),
      );
      return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();
  }
  return twoFactorEncKeyPromise;
}

async function encryptSecret(plaintext: string) {
  const key = await getTwoFactorEncKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext)),
  );
  return `v1:${bytesToHex(iv)}:${bytesToHex(cipher)}`;
}

async function decryptSecret(payload: string) {
  if (typeof payload !== "string") {
    return "";
  }
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return "";
  }
  try {
    const key = await getTwoFactorEncKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToBytes(parts[1]) },
      key,
      hexToBytes(parts[2]),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return "";
  }
}

// ── Backup recovery codes — stored only as SHA-256 hashes, single-use ────────
const BACKUP_CODE_COUNT = 10;
const normalizeBackupCode = (code: string) =>
  String(code || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const hashBackupCode = (code: string) => sha256Hex(`backup:${normalizeBackupCode(code)}`);

const generateBackupCodes = (count = BACKUP_CODE_COUNT) => {
  const codes: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const raw = bytesToHex(crypto.getRandomValues(new Uint8Array(5))).toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
};

async function hashBackupCodes(codes: string[]) {
  return await Promise.all(codes.map((code) => hashBackupCode(code)));
}

async function derivePasswordHash(password: string, saltHex: string, iterations: number) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(saltHex),
      iterations,
    },
    baseKey,
    256,
  );

  return bytesToHex(new Uint8Array(bits));
}

async function createPasswordRecord(password: string) {
  const passwordSalt = createRandomToken(16);
  const passwordHash = await derivePasswordHash(password, passwordSalt, PASSWORD_HASH_ITERATIONS);

  return {
    passwordSalt,
    passwordHash,
    passwordIterations: PASSWORD_HASH_ITERATIONS,
    passwordUpdatedAt: new Date().toISOString(),
  };
}

async function verifyPassword(password: string, authRecord: any) {
  if (!authRecord?.passwordSalt || !authRecord?.passwordHash) {
    return false;
  }

  const expected = await derivePasswordHash(
    password,
    authRecord.passwordSalt,
    toSafeNumber(authRecord.passwordIterations, PASSWORD_HASH_ITERATIONS),
  );

  return timingSafeEqual(expected, String(authRecord.passwordHash));
}

async function persistLocalAuthRecord(authRecord: any) {
  const normalizedEmail = normalizeEmail(authRecord?.email);
  if (!authRecord?.userId || !normalizedEmail) {
    throw new Error("Invalid auth record");
  }

  authRecord.email = normalizedEmail;
  await kv.mset(
    [authUserKey(authRecord.userId), authEmailKey(normalizedEmail)],
    [authRecord, authRecord.userId],
  );
}

async function getLocalAuthRecordByUserId(userId: string) {
  if (!userId) {
    return null;
  }
  return await kv.get(authUserKey(userId));
}

async function deleteLocalAuthRecord(userId: string) {
  if (!userId) {
    return;
  }

  const authRecord = await getLocalAuthRecordByUserId(userId);
  const keys = [authUserKey(userId)];
  if (authRecord?.email) {
    keys.push(authEmailKey(normalizeEmail(authRecord.email)));
  }

  await kv.mdel(keys);
}

async function findUserProfileByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const candidates = (await kv.getByPrefix("user:")) || [];
  for (const candidate of candidates) {
    const profile = normalizeUserProfile(candidate);
    if (!profile?.id) {
      continue;
    }

    if (normalizeEmail(profile.email) === normalizedEmail) {
      return profile;
    }
  }

  return null;
}

async function getLocalAuthRecordByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const indexedUserId = await kv.get(authEmailKey(normalizedEmail));
  if (typeof indexedUserId === "string" && indexedUserId) {
    const indexedRecord = await getLocalAuthRecordByUserId(indexedUserId);
    if (indexedRecord) {
      if (normalizeEmail(indexedRecord.email) !== normalizedEmail) {
        indexedRecord.email = normalizedEmail;
        await persistLocalAuthRecord(indexedRecord);
      }
      return indexedRecord;
    }
  }

  // Compatibility fallback: older deployments may contain auth records
  // without a valid auth:email index. Rebuild the index from auth:user:* records.
  const allAuthRecords = (await kv.getByPrefix("auth:user:")) || [];
  for (const candidate of allAuthRecords) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }

    if (!candidate?.userId || !candidate?.email) {
      continue;
    }

    const hasPasswordRecord =
      (typeof candidate.passwordHash === "string" && Boolean(candidate.passwordHash)) ||
      (typeof candidate.passwordSalt === "string" && Boolean(candidate.passwordSalt));
    if (!hasPasswordRecord) {
      continue;
    }

    if (normalizeEmail(candidate.email) !== normalizedEmail) {
      continue;
    }

    candidate.email = normalizedEmail;
    await persistLocalAuthRecord(candidate);
    return candidate;
  }

  const profile = await findUserProfileByEmail(normalizedEmail);
  if (!profile?.id) {
    return null;
  }

  const authRecord = await getLocalAuthRecordByUserId(profile.id);
  if (!authRecord) {
    return null;
  }

  if (normalizeEmail(authRecord.email) !== normalizedEmail) {
    authRecord.email = normalizedEmail;
  }
  await persistLocalAuthRecord(authRecord);
  return authRecord;
}

async function createSessionPair(userId: string, email: string) {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = new Date(now + ACCESS_TOKEN_TTL_MS).toISOString();

  // Access token: JWT when possible (no DB write/read needed).
  const accessToken = JWT_ENABLED
    ? await signJwtToken(userId, normalizedEmail, expiresAt)
    : createRandomToken(32);

  const refreshToken = createRandomToken(32);

  if (JWT_ENABLED) {
    // Only write the refresh token to the DB.
    const refreshSession = { type: "refresh", userId, email: normalizedEmail, createdAt, expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString() };
    await kv.set(authRefreshKey(refreshToken), refreshSession);
    const persisted = await getValidSession(refreshToken, "refresh");
    if (!persisted) throw new Error("Failed to persist refresh session");
  } else {
    // Legacy: store both tokens in DB.
    const accessSession = { type: "access", userId, email: normalizedEmail, createdAt, expiresAt };
    const refreshSession = { type: "refresh", userId, email: normalizedEmail, createdAt, expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString() };
    await kv.mset([authAccessKey(accessToken), authRefreshKey(refreshToken)], [accessSession, refreshSession]);
    const persistedAccess = await getValidSession(accessToken, "access");
    const persistedRefresh = await getValidSession(refreshToken, "refresh");
    if (!persistedAccess || !persistedRefresh) throw new Error("Failed to persist authentication session");
  }

  return { accessToken, refreshToken };
}

async function createPasswordResetSession(userId: string, email: string) {
  const resetToken = createRandomToken(32);
  const resetTokenHash = await sha256Hex(resetToken);

  await kv.set(authPasswordResetKey(resetTokenHash), {
    userId,
    email: normalizeEmail(email),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
  });

  return resetToken;
}

async function createEmailConfirmationSession(userId: string, email: string) {
  const confirmationToken = createRandomToken(32);
  const confirmationTokenHash = await sha256Hex(confirmationToken);

  await kv.set(authEmailConfirmationKey(confirmationTokenHash), {
    userId,
    email: normalizeEmail(email),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + EMAIL_CONFIRMATION_TTL_MS).toISOString(),
  });

  return confirmationToken;
}

// Create (and store the hash of) a 6-digit signup email-verification code.
// Returns the plaintext code so the caller can email it (or reveal it as a
// fallback when SMTP is not configured).
async function createEmailVerificationCode(userId: string, email: string) {
  const code = generateTwoFactorCode();
  const now = Date.now();

  await kv.set(authEmailVerifyCodeKey(userId), {
    userId,
    email: normalizeEmail(email),
    codeHash: await sha256Hex(code),
    attempts: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + EMAIL_VERIFICATION_CODE_TTL_MS).toISOString(),
  });

  return code;
}

// Deliver the signup verification code. Mirrors the two-factor delivery contract:
// returns { deliveryMethod, code } where the code is surfaced for the "fallback"
// method so verification never hard-depends on email delivery in dev/preview.
async function sendEmailVerificationChallenge(userId: string, email: string) {
  const code = await createEmailVerificationCode(userId, email);
  if (isEmailDeliveryConfigured) {
    try {
      await sendEmailVerificationCodeEmail(email, code);
      return { deliveryMethod: "email", code } as const;
    } catch (error) {
      console.error("Verification code email error:", error);
      return { deliveryMethod: "fallback", code } as const;
    }
  }
  return { deliveryMethod: "fallback", code } as const;
}

const toFiniteNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const TWO_FACTOR_CODE_PATTERN = /^\d{6}$/;

const generateTwoFactorCode = () =>
  String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const isTwoFactorEnabled = (authRecord: any) => {
  if (typeof authRecord?.twoFactorEnabled === "boolean") {
    return authRecord.twoFactorEnabled;
  }
  return requireTwoFactorByDefault;
};

// True only when the user has a real authenticator (TOTP) secret enrolled.
const hasTotpEnrolled = (authRecord: any) =>
  Boolean(authRecord?.twoFactorEnabled && typeof authRecord?.totpSecretEnc === "string" && authRecord.totpSecretEnc);

// ── Trusted-device recognition (risk-based challenges) ───────────────────────
// A device is identified by a stable client id (x-device-id) combined with the
// user agent + language. New/unrecognized devices must pass a challenge.
async function computeDeviceHash(req: Request) {
  const deviceId = (req.headers.get("x-device-id") || "").trim();
  const userAgent = (req.headers.get("user-agent") || "").trim();
  const acceptLanguage = (req.headers.get("accept-language") || "").trim();
  if (!deviceId && !userAgent) {
    return "";
  }
  return await sha256Hex(`${deviceId}|${userAgent}|${acceptLanguage}`);
}

const summarizeUserAgent = (userAgent: string) => {
  const ua = String(userAgent || "").trim();
  if (!ua) return "Unknown device";
  return ua.length > 80 ? `${ua.slice(0, 77)}…` : ua;
};

async function getTrustedDevices(userId: string) {
  const list = await kv.get(authTrustedDevicesKey(userId));
  if (!Array.isArray(list)) {
    return [] as Array<{ deviceHash: string; label?: string; lastSeenAt?: string; expiresAt?: string }>;
  }
  const now = Date.now();
  return list.filter(
    (entry) =>
      entry &&
      typeof entry.deviceHash === "string" &&
      (!entry.expiresAt || Date.parse(entry.expiresAt) > now),
  );
}

async function isTrustedDevice(userId: string, deviceHash: string) {
  if (!deviceHash) {
    return false;
  }
  const devices = await getTrustedDevices(userId);
  return devices.some((entry) => timingSafeEqual(String(entry.deviceHash), deviceHash));
}

async function rememberTrustedDevice(userId: string, deviceHash: string, userAgent?: string) {
  if (!deviceHash) {
    return;
  }
  const devices = await getTrustedDevices(userId);
  const now = Date.now();
  const expiresAt = new Date(now + TRUSTED_DEVICE_TTL_MS).toISOString();
  const existing = devices.find((entry) => entry.deviceHash === deviceHash);

  if (existing) {
    existing.lastSeenAt = new Date(now).toISOString();
    existing.expiresAt = expiresAt;
  } else {
    devices.push({
      deviceHash,
      label: summarizeUserAgent(userAgent || ""),
      lastSeenAt: new Date(now).toISOString(),
      expiresAt,
    });
  }

  // Keep the most recent 20 devices to bound the record size.
  await kv.set(authTrustedDevicesKey(userId), devices.slice(-20));
}

// ── 2FA credential verification (TOTP code or single-use backup code) ────────
async function consumeBackupCode(authRecord: any, submitted: string) {
  const codes = Array.isArray(authRecord?.backupCodes) ? authRecord.backupCodes : [];
  if (!codes.length) {
    return false;
  }
  const submittedHash = await hashBackupCode(submitted);
  const index = codes.findIndex((hash: any) => timingSafeEqual(String(hash), submittedHash));
  if (index === -1) {
    return false;
  }
  codes.splice(index, 1);
  authRecord.backupCodes = codes;
  await persistLocalAuthRecord(authRecord);
  return true;
}

// Verify an authenticator code or a backup code against the user's enrolled secret.
async function verifyTwoFactorCredential(authRecord: any, submitted: string) {
  const code = String(submitted || "").trim();
  if (!code) {
    return false;
  }
  if (typeof authRecord?.totpSecretEnc === "string" && authRecord.totpSecretEnc) {
    const secret = await decryptSecret(authRecord.totpSecretEnc);
    if (secret && (await verifyTotpCode(secret, code))) {
      return true;
    }
  }
  return await consumeBackupCode(authRecord, code);
}

// ── Step-up challenge for sensitive actions (password/email change, disable 2FA)
// TOTP users confirm with their authenticator; everyone else gets an emailed code.
async function createStepUpEmailCode(authRecord: any) {
  const code = generateTwoFactorCode();
  const now = Date.now();
  await kv.set(authStepUpKey(authRecord.userId), {
    userId: authRecord.userId,
    email: normalizeEmail(authRecord.email),
    codeHash: await sha256Hex(code),
    attempts: 0,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TWO_FACTOR_TTL_MS).toISOString(),
  });

  if (isEmailDeliveryConfigured) {
    try {
      await sendTwoFactorCodeEmail(authRecord.email, code);
      return { deliveryMethod: "email", code } as const;
    } catch (error) {
      console.error("Step-up code email error:", error);
      return { deliveryMethod: "fallback", code } as const;
    }
  }
  return { deliveryMethod: "fallback", code } as const;
}

async function verifyStepUpEmailCode(authRecord: any, submitted: string) {
  const code = String(submitted || "").trim();
  if (!TWO_FACTOR_CODE_PATTERN.test(code)) {
    return false;
  }
  const session = await kv.get(authStepUpKey(authRecord.userId));
  if (!session?.codeHash) {
    return false;
  }
  const expiresAt = typeof session.expiresAt === "string" ? Date.parse(session.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await kv.del(authStepUpKey(authRecord.userId));
    return false;
  }
  const attempts = toFiniteNumber(session.attempts, 0);
  if (attempts >= TWO_FACTOR_MAX_ATTEMPTS) {
    await kv.del(authStepUpKey(authRecord.userId));
    return false;
  }
  const submittedHash = await sha256Hex(code);
  if (!timingSafeEqual(submittedHash, String(session.codeHash))) {
    await kv.set(authStepUpKey(authRecord.userId), { ...session, attempts: attempts + 1 });
    return false;
  }
  await kv.del(authStepUpKey(authRecord.userId));
  return true;
}

// Unified gate: returns { ok: true } when the step-up is satisfied, otherwise a
// descriptor the caller returns to the client to drive the challenge prompt.
// When no code is supplied and the user relies on an emailed code, one is sent.
async function evaluateStepUp(authRecord: any, challengeCode?: string) {
  const usesTotp = hasTotpEnrolled(authRecord);
  const challengeType: "totp" | "email" = usesTotp ? "totp" : "email";
  const code = String(challengeCode || "").trim();

  if (!code) {
    let delivery: { deliveryMethod: string; code: string } | null = null;
    if (!usesTotp) {
      delivery = await createStepUpEmailCode(authRecord);
    }
    return {
      ok: false as const,
      requiresChallenge: true,
      challengeType,
      message:
        challengeType === "totp"
          ? "Enter the code from your authenticator app to continue."
          : delivery?.deliveryMethod === "email"
            ? "We sent a 6-digit confirmation code to your email."
            : "Enter the confirmation code to continue.",
      ...(delivery && delivery.deliveryMethod === "fallback" ? { verificationCode: delivery.code } : {}),
    };
  }

  const verified = usesTotp
    ? await verifyTwoFactorCredential(authRecord, code)
    : await verifyStepUpEmailCode(authRecord, code);

  if (!verified) {
    return {
      ok: false as const,
      requiresChallenge: true,
      challengeType,
      error: "Invalid confirmation code. Please try again.",
    };
  }

  return { ok: true as const };
}

async function clearTwoFactorSession(tokenHash: string, fallbackUserId?: string) {
  if (!tokenHash) {
    return;
  }

  const existingSession = await kv.get(authTwoFactorSessionKey(tokenHash));
  const userId = existingSession?.userId || fallbackUserId;
  const keys = [authTwoFactorSessionKey(tokenHash)];

  if (userId) {
    keys.push(authUserTwoFactorSessionKey(userId));
  }

  await kv.mdel(keys);
}

type TwoFactorChallengeOptions = {
  // "email" sends a 6-digit code; "totp" expects an authenticator/backup code
  // (no email is sent — the secret already lives in the user's app).
  challengeType?: "email" | "totp";
  deviceHash?: string;
  rememberDevice?: boolean;
  purpose?: string;
};

async function createTwoFactorSession(
  userId: string,
  email: string,
  options: TwoFactorChallengeOptions = {},
) {
  const challengeType = options.challengeType === "totp" ? "totp" : "email";
  const token = createRandomToken(32);
  const tokenHash = await sha256Hex(token);
  const previousTokenHash = await kv.get(authUserTwoFactorSessionKey(userId));
  if (typeof previousTokenHash === "string" && previousTokenHash) {
    await kv.del(authTwoFactorSessionKey(previousTokenHash));
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const code = challengeType === "email" ? generateTwoFactorCode() : "";

  const session = {
    userId,
    email: normalizeEmail(email),
    challengeType,
    codeHash: code ? await sha256Hex(code) : "",
    deviceHash: options.deviceHash || "",
    rememberDevice: options.rememberDevice === true,
    purpose: options.purpose || "login",
    attempts: 0,
    resendCount: 0,
    lastSentAt: nowIso,
    createdAt: nowIso,
    expiresAt: new Date(now + TWO_FACTOR_TTL_MS).toISOString(),
  };

  await kv.mset(
    [authTwoFactorSessionKey(tokenHash), authUserTwoFactorSessionKey(userId)],
    [session, tokenHash],
  );

  // Authenticator-app challenge: nothing to deliver.
  if (challengeType === "totp") {
    return { token, deliveryMethod: "totp", challengeType } as const;
  }

  try {
    if (isEmailDeliveryConfigured) {
      await sendTwoFactorCodeEmail(session.email, code);
      return {
        token,
        deliveryMethod: "email",
        challengeType,
        code,
      } as const;
    }

    return {
      token,
      deliveryMethod: "fallback",
      challengeType,
      fallbackCode: code,
      code,
    } as const;
  } catch (error) {
    await clearTwoFactorSession(tokenHash, userId);
    throw error;
  }
}

async function resendTwoFactorSessionCode(token: string) {
  const tokenHash = await sha256Hex(token);
  const session = await kv.get(authTwoFactorSessionKey(tokenHash));
  if (!session?.userId) {
    return { error: "Invalid or expired verification session.", status: 401 } as const;
  }

  // Authenticator-app challenges have no emailed code to resend.
  if (session.challengeType === "totp") {
    return { error: "Open your authenticator app for the current code.", status: 400 } as const;
  }

  const now = Date.now();
  const expiresAt = typeof session.expiresAt === "string" ? Date.parse(session.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    await clearTwoFactorSession(tokenHash, session.userId);
    return { error: "Verification session expired. Please sign in again.", status: 401 } as const;
  }

  const resendCount = toFiniteNumber(session.resendCount, 0);
  if (resendCount >= TWO_FACTOR_MAX_RESENDS) {
    return { error: "Too many resend attempts. Please sign in again.", status: 429 } as const;
  }

  const lastSentAt = typeof session.lastSentAt === "string" ? Date.parse(session.lastSentAt) : Number.NaN;
  if (Number.isFinite(lastSentAt) && now - lastSentAt < TWO_FACTOR_RESEND_COOLDOWN_MS) {
    const waitMs = TWO_FACTOR_RESEND_COOLDOWN_MS - (now - lastSentAt);
    const waitSeconds = Math.ceil(waitMs / 1000);
    return {
      error: `Please wait ${waitSeconds} second${waitSeconds === 1 ? "" : "s"} before requesting another code.`,
      status: 429,
    } as const;
  }

  const code = generateTwoFactorCode();
  const codeHash = await sha256Hex(code);
  const nextSession = {
    ...session,
    codeHash,
    attempts: 0,
    resendCount: resendCount + 1,
    lastSentAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TWO_FACTOR_TTL_MS).toISOString(),
  };

  await kv.set(authTwoFactorSessionKey(tokenHash), nextSession);

  if (isEmailDeliveryConfigured) {
    await sendTwoFactorCodeEmail(nextSession.email, code);
    return { success: true, deliveryMethod: "email", code } as const;
  }

  return {
    success: true,
    deliveryMethod: "fallback",
    fallbackCode: code,
    code,
  } as const;
}

async function getValidSession(token: string, type: "access" | "refresh") {
  // For access tokens, try JWT first — zero DB round trip.
  if (type === "access" && JWT_ENABLED && token.split(".").length === 3) {
    const jwtData = await verifyJwtToken(token);
    if (jwtData) {
      return { type: "access", userId: jwtData.userId, email: jwtData.email, expiresAt: jwtData.expiresAt };
    }
    return null;
  }

  // Refresh tokens and legacy opaque access tokens: DB lookup.
  try {
    const lookupKey = type === "access" ? authAccessKey(token) : authRefreshKey(token);
    const session = await kv.get(lookupKey);
    if (!session?.userId || session?.type !== type) {
      return null;
    }
    const expiresAt = typeof session.expiresAt === "string" ? Date.parse(session.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      try { await kv.del(lookupKey); } catch {}
      return null;
    }
    return session;
  } catch (error) {
    console.error('Get valid session error:', error);
    return null;
  }
}

async function createPasswordResetLink(req: Request, token: string) {
  const path = `/reset-password?access_token=${encodeURIComponent(token)}&type=recovery`;
  return resolveFrontendRedirectTo(req, path) || path;
}

async function createEmailConfirmationLink(req: Request, token: string) {
  const path = `/confirm-email?token=${encodeURIComponent(token)}`;
  return resolveFrontendRedirectTo(req, path) || path;
}

async function ensureLocalAdminUser() {
  const adminEmail = normalizeEmail(Deno.env.get("ADMIN_EMAIL"));
  const adminPassword = (Deno.env.get("ADMIN_PASSWORD") || "").trim();

  if (!adminEmail || !adminPassword) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file");
    return;
  }

  let profile = await findUserProfileByEmail(adminEmail);

  if (!profile) {
    const userId = crypto.randomUUID();
    profile = {
      id: userId,
      name: "Admin",
      email: adminEmail,
      phone: "000000000",
      university: "UNITRADE",
      studentId: "",
      rating: 0,
      reviewCount: 0,
      isVerified: true,
      isApproved: true,
      role: "admin",
      userType: "seller",
      profilePicture: "",
      avatar: "",
      isBanned: false,
      createdAt: new Date().toISOString(),
    };

    await kv.mset(
      [`user:${userId}`, `wallet:${userId}`],
      [
        profile,
        {
          userId,
          availableBalance: 0,
          pendingBalance: 0,
          updatedAt: new Date().toISOString(),
        },
      ],
    );
    console.log("Admin user created successfully");
  } else {
    let changed = false;

    if (profile.role !== "admin") {
      profile.role = "admin";
      changed = true;
    }
    if (profile.userType !== "seller") {
      profile.userType = "seller";
      changed = true;
    }
    if (!profile.isApproved) {
      profile.isApproved = true;
      changed = true;
    }
    if (!profile.isVerified) {
      profile.isVerified = true;
      changed = true;
    }
    if (normalizeEmail(profile.email) !== adminEmail) {
      profile.email = adminEmail;
      changed = true;
    }

    if (changed) {
      await kv.set(`user:${profile.id}`, profile);
    }

    const wallet = await kv.get(`wallet:${profile.id}`);
    if (!wallet) {
      await kv.set(`wallet:${profile.id}`, {
        userId: profile.id,
        availableBalance: 0,
        pendingBalance: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  let authRecord = await getLocalAuthRecordByUserId(profile.id);
  if (!authRecord) {
    authRecord = {
      userId: profile.id,
      email: adminEmail,
      emailVerified: true,
      emailConfirmedAt: new Date().toISOString(),
      twoFactorEnabled: requireTwoFactorByDefault,
      ...(await createPasswordRecord(adminPassword)),
      createdAt: new Date().toISOString(),
    };
    await persistLocalAuthRecord(authRecord);
    console.log("Admin auth credentials initialized");
    return;
  }

  if (normalizeEmail(authRecord.email) !== adminEmail) {
    authRecord.email = adminEmail;
  }
  if (authRecord.emailVerified === false) {
    authRecord.emailVerified = true;
    authRecord.emailConfirmedAt = authRecord.emailConfirmedAt || new Date().toISOString();
  }
  if (typeof authRecord.twoFactorEnabled !== "boolean") {
    authRecord.twoFactorEnabled = requireTwoFactorByDefault;
  }
  await persistLocalAuthRecord(authRecord);
  if (normalizeEmail(authRecord.email) === adminEmail) {
    await kv.set(authEmailKey(adminEmail), profile.id);
  }
}

ensureLocalAdminUser().catch(console.error);

const DEFAULT_ADMIN_SETTINGS = {
  platformName: "UNITRADE",
  supportEmail: "support@UNITRADE.cm",
  maintenanceMode: false,
  allowNewRegistrations: true,
  platformCommissionPercent: 5,
  payoutFeePercent: 5,
  minimumPayoutAmount: 1000,
  autoPayoutToMobileMoney: true,
  updatedAt: "",
};

const DEFAULT_ADMIN_UNIVERSITIES = [
  "University of Buea",
  "University of Bamenda",
  "University of Yaounde I",
  "University of Yaounde II (Soa)",
  "ICT University",
  "Catholic University of Central Africa (UCAC)",
  "National Advanced School of Engineering Yaounde",
  "IRIC - University of Yaounde II",
  "Universite Protestante d'Afrique Centrale",
  "Yaounde School of Management",
  "University of Douala",
  "University of Dschang",
  "University of Ngaoundere",
  "University of Maroua",
];

const DEFAULT_ADMIN_CATEGORIES = [
  "Beds & Mattresses",
  "Chairs & Tables",
  "Kitchen Items",
  "Appliances",
  "Electronics",
  "Study Desk & Lamps",
  "Curtains & Rugs",
  "Shelves & Storage",
];

// Keep catalog reads Postgres-first by default.
// Set AUTO_SEED_CATALOG_DEFAULTS=true only when you explicitly want baseline seed data.
const AUTO_SEED_CATALOG_DEFAULTS = /^(1|true|yes|on)$/i.test(
  (Deno.env.get("AUTO_SEED_CATALOG_DEFAULTS") || "").trim(),
);

// Static demo marketplace sellers/listings were removed intentionally.

const SUBSCRIPTION_PLAN_PRICING = {
  buyer: {
    monthly: 500,
    yearly: 6000,
  },
  seller: {
    monthly: 1000,
    yearly: 12000,
  },
} as const;

const parseFlexibleNumber = (value: any) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return Number.NaN;

    // Accept "25.5", "25,5", "1,000.5" and "1.000,5" styles.
    let normalized = trimmed.replace(/\s+/g, "");
    const hasComma = normalized.includes(",");
    const hasDot = normalized.includes(".");

    if (hasComma && hasDot) {
      if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      } else {
        normalized = normalized.replace(/,/g, "");
      }
    } else if (hasComma) {
      if (/^-?\d{1,3}(,\d{3})+$/.test(normalized)) {
        normalized = normalized.replace(/,/g, "");
      } else {
        normalized = normalized.replace(",", ".");
      }
    }

    return Number(normalized);
  }

  return Number(value);
};

const toSafeNumber = (value: any, fallback = 0) => {
  const num = parseFlexibleNumber(value);
  return Number.isFinite(num) ? num : fallback;
};

const isProduction = () => String(Deno.env.get("NODE_ENV") || "").toLowerCase() === "production";
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const exposeInternalErrors = () =>
  /^(1|true|yes|on)$/i.test(String(Deno.env.get("EXPOSE_INTERNAL_ERRORS") || "").trim());
const internalErrorPayload = (message: string, error: unknown) =>
  isProduction() && !exposeInternalErrors()
    ? { error: message }
    : { error: message, details: errorMessage(error) };

const roundMoney = (value: any) => {
  const safeValue = toSafeNumber(value, 0);
  return Math.round((safeValue + Number.EPSILON) * 100) / 100;
};

// XAF does not use fractional units for mobile money requests.
const roundXafAmount = (value: any) => {
  const safeValue = toSafeNumber(value, 0);
  return Math.max(0, Math.round(safeValue));
};

const CAMEROON_GEO_BOUNDS = {
  minLat: 1.6,
  maxLat: 13.2,
  minLng: 8.4,
  maxLng: 16.3,
};

const ALLOWED_PICKUP_LOCATIONS = [
  { name: "University of Yaounde I", lat: 3.848, lng: 11.502, type: "campus" },
  { name: "University of Yaounde II (Soa)", lat: 3.985, lng: 11.597, type: "campus" },
  { name: "ICT University, Yaounde", lat: 3.87, lng: 11.515, type: "campus" },
  { name: "Catholic University of Central Africa (UCAC)", lat: 3.877, lng: 11.531, type: "campus" },
  { name: "National Advanced School of Engineering Yaounde", lat: 3.861, lng: 11.501, type: "campus" },
  { name: "IRIC Yaounde", lat: 3.878, lng: 11.535, type: "campus" },
  { name: "University of Douala", lat: 4.053, lng: 9.704, type: "campus" },
  { name: "Ngoa Ekelle", lat: 3.864, lng: 11.5, type: "roundabout" },
  { name: "Poste Centrale Yaounde Roundabout", lat: 3.865, lng: 11.515, type: "roundabout" },
  { name: "Elig-Essono Roundabout", lat: 3.881, lng: 11.513, type: "roundabout" },
  { name: "Bonamoussadi Roundabout", lat: 4.088, lng: 9.758, type: "roundabout" },
  { name: "Bambili Campus", lat: 5.959, lng: 10.197, type: "campus" },
];

const ALLOWED_PICKUP_KEYWORDS = [
  "university",
  "campus",
  "roundabout",
  "ngoa ekelle",
  "soa",
  "ict",
  "ucac",
  "iric",
  "poste centrale",
  "elig essono",
  "bonamoussadi",
  "bambili",
  "yaounde",
  "douala",
];

const ORDER_STATUS = {
  AWAITING_PAYMENT: "awaiting_payment",
  PAID_PENDING_DELIVERY: "paid_pending_delivery",
  DELIVERED_RELEASED: "delivered_released",
  REFUNDED: "refunded",
  PAYMENT_FAILED: "payment_failed",
} as const;

const ESCROW_STATUS = {
  AWAITING: "awaiting_payment",
  PENDING: "pending",
  RELEASED: "released",
  REFUNDED: "refunded",
  VOIDED: "voided",
} as const;

const WITHDRAWAL_STATUS = {
  REQUESTED: "requested",
  PROCESSING: "processing",
  COMPLETED: "completed",
  REJECTED: "rejected",
  FAILED: "failed",
} as const;

const REPORT_STATUS = {
  OPEN: "open",
  REVIEWED: "reviewed",
  RESOLVED: "resolved",
  REJECTED: "rejected",
} as const;

const ADMIN_WALLET_USER_ID = "platform-admin-wallet";

const normalizePhone = (value: any) => String(value || "").replace(/[^\d]/g, "");

const isValidCameroonPhone = (phoneNumber: string) => {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) return false;
  if (/^6\d{8}$/.test(normalized)) return true;
  if (/^2376\d{8}$/.test(normalized)) return true;
  return false;
};

const isWithinCameroonBounds = (lat: any, lng: any) => {
  const latitude = toSafeNumber(lat, NaN);
  const longitude = toSafeNumber(lng, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  return (
    latitude >= CAMEROON_GEO_BOUNDS.minLat &&
    latitude <= CAMEROON_GEO_BOUNDS.maxLat &&
    longitude >= CAMEROON_GEO_BOUNDS.minLng &&
    longitude <= CAMEROON_GEO_BOUNDS.maxLng
  );
};

const matchesAllowedPickupName = (locationName: string) => {
  const normalized = locationName.trim().toLowerCase();
  if (!normalized) return false;

  if (ALLOWED_PICKUP_LOCATIONS.some((location) => normalized.includes(location.name.toLowerCase()))) {
    return true;
  }

  return ALLOWED_PICKUP_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const isAllowedPickupLocation = (locationName: string, lat: any, lng: any) => {
  if (!matchesAllowedPickupName(locationName)) {
    return false;
  }

  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return true;
  }

  return isWithinCameroonBounds(lat, lng);
};

const createEntityId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeUniversityEntry = (entry: any) => {
  if (!entry || typeof entry !== "object") return null;
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!name) return null;
  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : createEntityId("UNI"),
    name,
    isActive: typeof entry.isActive === "boolean" ? entry.isActive : true,
    createdAt: typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString(),
    updatedAt: typeof entry.updatedAt === "string" && entry.updatedAt ? entry.updatedAt : new Date().toISOString(),
  };
};

const normalizeCategoryEntry = (entry: any) => {
  if (!entry || typeof entry !== "object") return null;
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!name) return null;
  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : createEntityId("CAT"),
    name,
    isActive: typeof entry.isActive === "boolean" ? entry.isActive : true,
    createdAt: typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString(),
    updatedAt: typeof entry.updatedAt === "string" && entry.updatedAt ? entry.updatedAt : new Date().toISOString(),
  };
};

async function ensureAdminUniversities() {
  const saved = await kv.get("admin:universities");
  if (Array.isArray(saved)) {
    const normalized = saved
      .map((entry: any) => normalizeUniversityEntry(entry))
      .filter((entry: any) => entry !== null);
    if (normalized.length > 0) {
      await kv.set("admin:universities", normalized);
      return normalized;
    }

    // Existing key is present but contains invalid/empty payload.
    // Do not silently inject defaults unless explicitly requested.
    if (!AUTO_SEED_CATALOG_DEFAULTS) {
      return [];
    }
  }

  if (!AUTO_SEED_CATALOG_DEFAULTS) {
    return [];
  }

  const now = new Date().toISOString();
  const seeded = DEFAULT_ADMIN_UNIVERSITIES.map((name) => ({
    id: createEntityId("UNI"),
    name,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
  await kv.set("admin:universities", seeded);
  return seeded;
}

async function ensureAdminCategories() {
  const saved = await kv.get("admin:categories");
  if (Array.isArray(saved)) {
    const normalized = saved
      .map((entry: any) => normalizeCategoryEntry(entry))
      .filter((entry: any) => entry !== null);
    if (normalized.length > 0) {
      await kv.set("admin:categories", normalized);
      return normalized;
    }

    // Existing key is present but contains invalid/empty payload.
    // Do not silently inject defaults unless explicitly requested.
    if (!AUTO_SEED_CATALOG_DEFAULTS) {
      return [];
    }
  }

  if (!AUTO_SEED_CATALOG_DEFAULTS) {
    return [];
  }

  const now = new Date().toISOString();
  const seeded = DEFAULT_ADMIN_CATEGORIES.map((name) => ({
    id: createEntityId("CAT"),
    name,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
  await kv.set("admin:categories", seeded);
  return seeded;
}

const LEGACY_MOCK_LISTING_IDS = new Set(["1", "2", "3", "4", "5", "6", "7", "8"]);
const LEGACY_MOCK_SELLER_IDS = new Set(["1", "2", "3", "admin1"]);
const LEGACY_MOCK_TITLES = new Set([
  "comfortable single bed with mattress",
  "study desk and chair set",
  "mini fridge - 120l",
  "complete kitchen utensil set",
  "standing fan",
  "plastic wardrobe",
  "dining table with 4 chairs",
  "reading lamp",
]);

const isDemoMarketplaceListing = (listing: any) => {
  if (!listing || typeof listing !== "object") {
    return false;
  }

  const id = typeof listing.id === "string" ? listing.id : "";
  const sellerId = typeof listing.sellerId === "string" ? listing.sellerId : "";
  const title = typeof listing.title === "string" ? listing.title.trim().toLowerCase() : "";

  const isLegacyMockListing =
    LEGACY_MOCK_LISTING_IDS.has(id) ||
    (LEGACY_MOCK_SELLER_IDS.has(sellerId) && LEGACY_MOCK_TITLES.has(title));

  return id.startsWith("LST-DEMO-") || sellerId.startsWith("USR-DEMO-") || isLegacyMockListing;
};

async function purgeDemoMarketplaceData() {
  const sellerIds = new Set<string>();

  const allListings = await kv.getByPrefix("listing:");
  for (const listing of allListings || []) {
    if (!isDemoMarketplaceListing(listing)) {
      continue;
    }

    const listingId = typeof listing?.id === "string" ? listing.id.trim() : "";
    const sellerId = typeof listing?.sellerId === "string" ? listing.sellerId.trim() : "";

    if (listingId) {
      await kv.del(`listing:${listingId}`);
    }
    if (sellerId && (sellerId.startsWith("USR-DEMO-") || LEGACY_MOCK_SELLER_IDS.has(sellerId))) {
      sellerIds.add(sellerId);
    }
  }

  const allUsers = await kv.getByPrefix("user:");
  for (const user of allUsers || []) {
    const userId = typeof user?.id === "string" ? user.id.trim() : "";
    if (userId && (userId.startsWith("USR-DEMO-") || LEGACY_MOCK_SELLER_IDS.has(userId))) {
      sellerIds.add(userId);
    }
  }

  for (const sellerId of sellerIds) {
    await kv.del(`user:${sellerId}:listings`);
    await kv.del(`wallet:${sellerId}`);
    await kv.del(`user:${sellerId}`);

    const authRecord = await kv.get(authUserKey(sellerId));
    if (authRecord?.email) {
      await kv.del(authEmailKey(normalizeEmail(authRecord.email)));
    }
    await kv.del(authUserKey(sellerId));
  }
}

purgeDemoMarketplaceData().catch((error) => {
  console.error("Failed to purge demo marketplace data:", error);
});

const toDayKey = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const normalizeOrderStatusLabel = (status: string) => {
  if (status === ORDER_STATUS.AWAITING_PAYMENT) return "AWAITING PAYMENT";
  if (status === ORDER_STATUS.PAID_PENDING_DELIVERY) return "PAID - PENDING DELIVERY";
  if (status === ORDER_STATUS.DELIVERED_RELEASED) return "DELIVERED - RELEASED";
  if (status === ORDER_STATUS.REFUNDED) return "REFUNDED";
  if (status === ORDER_STATUS.PAYMENT_FAILED) return "PAYMENT FAILED";
  return status;
};

const REQUESTED_PAYMENT_PROVIDER_MODE = (Deno.env.get("PAYMENT_PROVIDER_MODE") || "").trim().toLowerCase();
// ── Fapshi payment provider (Direct Pay for collection, Payout for disbursement) ──
// Fapshi uses two header credentials (apiuser + apikey) with a SEPARATE pair per
// service: one for collection (charging buyers) and one for payout (paying sellers).
// There is no OAuth/token step. Minimum transaction amount is 100 XAF.
const FAPSHI_BASE_URL = (Deno.env.get("FAPSHI_BASE_URL") || "https://live.fapshi.com").replace(/\/+$/, "");
const FAPSHI_COLLECTION_API_USER = (Deno.env.get("FAPSHI_COLLECTION_API_USER") || "").trim();
const FAPSHI_COLLECTION_API_KEY = (Deno.env.get("FAPSHI_COLLECTION_API_KEY") || "").trim();
const FAPSHI_PAYOUT_API_USER = (Deno.env.get("FAPSHI_PAYOUT_API_USER") || "").trim();
const FAPSHI_PAYOUT_API_KEY = (Deno.env.get("FAPSHI_PAYOUT_API_KEY") || "").trim();
const FAPSHI_MIN_AMOUNT = 100;
const FAPSHI_COLLECTION_READY = Boolean(FAPSHI_COLLECTION_API_USER && FAPSHI_COLLECTION_API_KEY);
const FAPSHI_PAYOUT_READY = Boolean(FAPSHI_PAYOUT_API_USER && FAPSHI_PAYOUT_API_KEY);
// Kept the env name PAYMENT_PROVIDER_MODE for compatibility; "fapshi" or "mock".
const PAYMENT_PROVIDER_MODE = (() => {
  if (REQUESTED_PAYMENT_PROVIDER_MODE === "mock") return "mock";
  return FAPSHI_COLLECTION_READY ? "fapshi" : "mock";
})();
// Kill-switch: FAPSHI_FORCE_MOCK=true simulates success without hitting Fapshi.
const FAPSHI_FORCE_MOCK = (Deno.env.get("FAPSHI_FORCE_MOCK") || "").toLowerCase() === "true";
const MERCHANT_MOMO_NUMBER = normalizePhone(Deno.env.get("MERCHANT_MOMO_NUMBER") || "671562474");
const MERCHANT_MOMO_NAME = Deno.env.get("MERCHANT_MOMO_NAME") || "nkinyampraisesncha";
const TRANSACTION_FEE_PERCENT = Math.max(0, toSafeNumber(Deno.env.get("TRANSACTION_FEE_PERCENT"), 2));
const TRANSACTION_FEE_FLAT = Math.max(0, toSafeNumber(Deno.env.get("TRANSACTION_FEE_FLAT"), 0));
const WEBHOOK_SECRET_RAW = (Deno.env.get("WEBHOOK_SECRET") || "").trim();
const getLegacyEscrowBaseUrl = (value: string) => {
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const path = parsed.pathname || "";
    const normalizedPath = /\/webhook\/?$/i.test(path) ? "" : path;
    return `${parsed.origin}${normalizedPath}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
};
const DEFAULT_ESCROW_BASE_URL = getLegacyEscrowBaseUrl(WEBHOOK_SECRET_RAW);
const ESCROW_API_KEY = (Deno.env.get("ESCROW_API_KEY") || "").trim();
const ESCROW_API_BASE_URL = (
  Deno.env.get("ESCROW_API_BASE_URL") ||
  Deno.env.get("ESCROW_API_URL") ||
  DEFAULT_ESCROW_BASE_URL
).trim().replace(/\/+$/, "");
const ESCROW_API_STRICT = (Deno.env.get("ESCROW_API_STRICT") || "").toLowerCase() === "true";
const ESCROW_API_TIMEOUT_MS = Math.max(3000, toSafeNumber(Deno.env.get("ESCROW_API_TIMEOUT_MS"), 15000));
const ESCROW_API_CREATE_PATH = (Deno.env.get("ESCROW_API_CREATE_PATH") || "/escrow/hold").trim();
const ESCROW_API_RELEASE_PATH = (Deno.env.get("ESCROW_API_RELEASE_PATH") || "/escrow/release").trim();
const ESCROW_API_REFUND_PATH = (Deno.env.get("ESCROW_API_REFUND_PATH") || "/escrow/refund").trim();
const ESCROW_PROVIDER_ENABLED = Boolean(ESCROW_API_KEY && ESCROW_API_BASE_URL);

if (ESCROW_API_KEY && !ESCROW_API_BASE_URL) {
  console.warn("ESCROW_API_KEY is set but ESCROW_API_BASE_URL is missing. External escrow sync is disabled.");
}

if (REQUESTED_PAYMENT_PROVIDER_MODE === "fapshi" && !FAPSHI_COLLECTION_READY) {
  console.warn(
    "PAYMENT_PROVIDER_MODE=fapshi was requested but Fapshi collection credentials are incomplete. Falling back to mock payment mode.",
  );
}
if (FAPSHI_COLLECTION_READY && !FAPSHI_PAYOUT_READY) {
  console.warn(
    "Fapshi collection credentials are set but payout credentials are missing. Seller payouts will fail until FAPSHI_PAYOUT_API_USER/FAPSHI_PAYOUT_API_KEY are configured.",
  );
}

// Fapshi expects the local 9-digit Cameroon number (e.g. "671234567"), NOT E.164.
const formatCameroonPhoneLocal = (phone: string) => {
  let normalized = normalizePhone(phone);
  if (normalized.startsWith("237")) {
    normalized = normalized.slice(3);
  }
  return normalized;
};

const shouldUseMockProvider = () =>
  FAPSHI_FORCE_MOCK || PAYMENT_PROVIDER_MODE !== "fapshi";

const calculateTransactionFee = (amount: number) =>
  roundXafAmount((roundXafAmount(amount) * TRANSACTION_FEE_PERCENT) / 100 + TRANSACTION_FEE_FLAT);

type EscrowProviderAction = "hold" | "release" | "refund";

const ESCROW_ACTION_ENDPOINTS: Record<EscrowProviderAction, string> = {
  hold: ESCROW_API_CREATE_PATH || "/escrow/hold",
  release: ESCROW_API_RELEASE_PATH || "/escrow/release",
  refund: ESCROW_API_REFUND_PATH || "/escrow/refund",
};

const toApiPath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

async function callEscrowProvider(action: EscrowProviderAction, payload: Record<string, any>) {
  const endpoint = `${ESCROW_API_BASE_URL}${toApiPath(ESCROW_ACTION_ENDPOINTS[action])}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESCROW_API_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ESCROW_API_KEY,
        "x-escrow-api-key": ESCROW_API_KEY,
        Authorization: `Bearer ${ESCROW_API_KEY}`,
      },
      body: JSON.stringify({
        action,
        ...payload,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data: any = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { rawText };
      }
    }

    if (!response.ok) {
      const message =
        typeof data?.error === "string"
          ? data.error
          : (typeof data?.message === "string" ? data.message : `HTTP ${response.status}`);
      throw new Error(message);
    }

    const status = String(data?.status || data?.state || data?.result || "accepted").toLowerCase();
    const reference = String(
      data?.reference ||
      data?.escrow_reference ||
      data?.transaction_reference ||
      payload.escrowId ||
      payload.orderId ||
      "",
    );

    return {
      status,
      reference,
      raw: data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function syncEscrowProvider(action: EscrowProviderAction, payload: Record<string, any>) {
  const fallbackReference = String(payload?.escrowId || payload?.orderId || "");
  const now = new Date().toISOString();

  if (!ESCROW_PROVIDER_ENABLED) {
    return {
      provider: "internal",
      synced: false,
      action,
      status: "skipped",
      reference: fallbackReference,
      reason: ESCROW_API_KEY ? "missing-escrow-api-base-url" : "missing-escrow-api-key",
      raw: null,
      syncedAt: now,
    };
  }

  try {
    const result = await callEscrowProvider(action, payload);
    return {
      provider: "external-escrow",
      synced: true,
      action,
      status: result.status,
      reference: result.reference || fallbackReference,
      raw: result.raw,
      syncedAt: now,
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Escrow provider request failed";
    if (ESCROW_API_STRICT) {
      throw new Error(`Escrow ${action} sync failed: ${message}`);
    }
    console.error(`Escrow ${action} sync failed; using internal escrow fallback:`, message);
    return {
      provider: "internal-fallback",
      synced: false,
      action,
      status: "failed",
      reference: fallbackReference,
      error: message,
      raw: null,
      syncedAt: now,
    };
  }
}

// ── Payment audit log ────────────────────────────────────────────────────────
// Every payment event (collection, payout, webhook, reconciliation) is appended
// to an immutable audit trail under payment:audit:<id>, indexed for retrieval.
async function recordPaymentAudit(event: string, detail: Record<string, any> = {}) {
  try {
    const id = createEntityId("PAUD");
    const record = {
      id,
      event,
      at: new Date().toISOString(),
      ...detail,
    };
    await kv.set(`payment:audit:${id}`, record);
    const index = (await kv.get("payment:audit:ids")) || [];
    index.push(id);
    if (index.length > 1000) {
      index.splice(0, index.length - 1000);
    }
    await kv.set("payment:audit:ids", index);
    return record;
  } catch (error) {
    // Never let audit logging break a payment flow.
    console.error("Failed to write payment audit log:", error);
    return null;
  }
}

type FapshiService = "collection" | "payout";

const getFapshiCredentials = (service: FapshiService) =>
  service === "payout"
    ? { apiuser: FAPSHI_PAYOUT_API_USER, apikey: FAPSHI_PAYOUT_API_KEY }
    : { apiuser: FAPSHI_COLLECTION_API_USER, apikey: FAPSHI_COLLECTION_API_KEY };

// Low-level Fapshi HTTP call. Fapshi authenticates with apiuser + apikey headers
// (no token exchange). Throws a clean Error (no secret leakage) on non-2xx.
async function callFapshi(
  method: "GET" | "POST",
  path: string,
  service: FapshiService,
  payload?: Record<string, any>,
) {
  const { apiuser, apikey } = getFapshiCredentials(service);
  if (!apiuser || !apikey) {
    throw new Error(`Fapshi ${service} credentials are missing`);
  }

  const response = await fetch(`${FAPSHI_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apiuser,
      apikey,
    },
    body: method === "POST" ? JSON.stringify(payload || {}) : undefined,
  });

  const rawText = await response.text();
  let data: any = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }
  }

  if (!response.ok) {
    const rawMessage = typeof data?.rawText === "string" ? data.rawText.trim() : "";
    const detail = (
      data?.message ||
      data?.error ||
      (rawMessage.length > 300 ? `${rawMessage.slice(0, 300)}…` : rawMessage) ||
      ""
    ).toString();
    throw new Error(detail || `Fapshi API error (${response.status})`);
  }

  return data;
}

// Fetch the authoritative status of a transaction. This is the source of truth
// for webhook verification — never trust the webhook POST body directly.
async function getFapshiPaymentStatus(transId: string, service: FapshiService = "collection") {
  return await callFapshi("GET", `/payment-status/${encodeURIComponent(transId)}`, service);
}

// Normalize Fapshi status (CREATED|PENDING|SUCCESSFUL|FAILED|EXPIRED) to the
// lowercase vocabulary the rest of the codebase already uses.
const normalizeFapshiStatus = (status: any) => {
  const value = String(status || "").toUpperCase();
  if (value === "SUCCESSFUL") return "successful";
  if (value === "FAILED") return "failed";
  if (value === "EXPIRED") return "expired";
  if (value === "PENDING" || value === "CREATED") return "pending";
  return value.toLowerCase() || "pending";
};

const fapshiMedium = (provider: "mtn-momo" | "orange-money") =>
  provider === "orange-money" ? "orange money" : "mobile money";

// Charge a buyer via Fapshi Direct Pay. Returns immediately with status "pending"
// (a PIN prompt is pushed to the payer's phone); the SUCCESSFUL/FAILED outcome
// arrives later via webhook. The caller must NOT treat "pending" as paid.
async function processInboundMobileMoneyPayment(params: {
  amount: number;
  phoneNumber: string;
  provider: "mtn-momo" | "orange-money";
  reference: string;
  description: string;
  buyerName?: string;
  buyerEmail?: string;
  userId?: string;
  redirectUrl?: string;
}) {
  if (shouldUseMockProvider()) {
    return {
      provider: "mock",
      status: "successful",
      reference: `MOCK-PAY-${Date.now()}`,
      raw: { simulated: true },
      paymentLink: "",
    };
  }

  const normalizedAmount = roundXafAmount(params.amount);
  if (normalizedAmount < FAPSHI_MIN_AMOUNT) {
    throw new Error(`Minimum payment amount is ${FAPSHI_MIN_AMOUNT} XAF`);
  }

  // Hosted checkout: Fapshi returns a payment link the buyer is redirected to.
  // (Direct Pay / inline PIN prompt requires special account activation; this
  // /initiate-pay flow works on any verified account.) The buyer picks the
  // mobile-money operator on Fapshi's page; outcome confirmed via webhook.
  const payload: Record<string, any> = {
    amount: normalizedAmount,
    externalId: params.reference,
    message: params.description,
  };
  if (params.buyerEmail) payload.email = params.buyerEmail;
  if (params.userId) payload.userId = params.userId;
  if (params.redirectUrl) payload.redirectUrl = params.redirectUrl;

  const data = await callFapshi("POST", "/initiate-pay", "collection", payload);

  const transId = String(data?.transId || data?.transID || "");
  const paymentLink = String(data?.link || data?.paymentLink || "");
  if (!transId || !paymentLink) {
    throw new Error(data?.message || "Payment could not be initiated by Fapshi");
  }

  await recordPaymentAudit("initiate_pay", {
    transId,
    reference: params.reference,
    amount: normalizedAmount,
    provider: params.provider,
  });

  return {
    provider: "fapshi",
    status: "pending",
    reference: transId,
    raw: data,
    paymentLink,
  };
}

// Pay a seller (or refund a buyer) via Fapshi Payout. Uses the payout credential
// pair. Like collection, the final outcome is confirmed via webhook.
async function processOutboundMobileMoneyPayout(params: {
  amount: number;
  phoneNumber: string;
  provider: "mtn-momo" | "orange-money";
  reference: string;
  description: string;
  recipientName?: string;
  recipientEmail?: string;
  userId?: string;
}) {
  if (shouldUseMockProvider()) {
    return {
      provider: "mock",
      status: "successful",
      reference: `MOCK-WD-${Date.now()}`,
      raw: { simulated: true },
    };
  }

  const normalizedAmount = roundXafAmount(params.amount);
  if (normalizedAmount < FAPSHI_MIN_AMOUNT) {
    throw new Error(`Minimum payout amount is ${FAPSHI_MIN_AMOUNT} XAF`);
  }
  if (!FAPSHI_PAYOUT_READY) {
    throw new Error("Fapshi payout credentials are not configured");
  }

  const payload: Record<string, any> = {
    amount: normalizedAmount,
    phone: formatCameroonPhoneLocal(params.phoneNumber),
    medium: fapshiMedium(params.provider),
    externalId: params.reference,
    message: params.description,
  };
  if (params.recipientName) payload.name = params.recipientName;
  if (params.recipientEmail) payload.email = params.recipientEmail;
  if (params.userId) payload.userId = params.userId;

  const data = await callFapshi("POST", "/payout", "payout", payload);

  const transId = String(data?.transId || data?.transID || "");
  const status = normalizeFapshiStatus(data?.status || "pending");
  if (!transId) {
    throw new Error(data?.message || "Payout request was not accepted by Fapshi");
  }

  await recordPaymentAudit("payout_initiated", {
    transId,
    reference: params.reference,
    amount: normalizedAmount,
    provider: params.provider,
  });

  return {
    provider: "fapshi",
    status,
    reference: transId,
    raw: data,
  };
}

async function getAdminSettings() {
  const saved = (await kv.get("admin:settings")) || {};
  const commissionPercent = Math.max(
    0,
    toSafeNumber(saved.platformCommissionPercent ?? saved.payoutFeePercent, DEFAULT_ADMIN_SETTINGS.platformCommissionPercent),
  );
  const minimumPayoutAmount = Math.max(0, toSafeNumber(saved.minimumPayoutAmount, DEFAULT_ADMIN_SETTINGS.minimumPayoutAmount));

  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...saved,
    platformCommissionPercent: commissionPercent,
    payoutFeePercent: commissionPercent,
    minimumPayoutAmount,
    autoPayoutToMobileMoney:
      typeof saved.autoPayoutToMobileMoney === "boolean"
        ? saved.autoPayoutToMobileMoney
        : DEFAULT_ADMIN_SETTINGS.autoPayoutToMobileMoney,
  };
}

async function getWallet(userId: string) {
  const existing = (await kv.get(`wallet:${userId}`)) || {};
  const wallet = {
    userId,
    availableBalance: Math.max(0, roundMoney(existing.availableBalance)),
    pendingBalance: Math.max(0, roundMoney(existing.pendingBalance)),
    updatedAt: existing.updatedAt || new Date().toISOString(),
  };

  if (
    typeof existing.userId !== "string" ||
    typeof existing.availableBalance !== "number" ||
    typeof existing.pendingBalance !== "number"
  ) {
    wallet.updatedAt = new Date().toISOString();
    await kv.set(`wallet:${userId}`, wallet);
  }

  return wallet;
}

async function saveWallet(wallet: any) {
  const normalized = {
    userId: wallet.userId,
    availableBalance: Math.max(0, roundMoney(wallet.availableBalance)),
    pendingBalance: Math.max(0, roundMoney(wallet.pendingBalance)),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`wallet:${wallet.userId}`, normalized);
  return normalized;
}

async function adjustWallet(userId: string, changes: { availableDelta?: number; pendingDelta?: number }) {
  const wallet = await getWallet(userId);
  wallet.availableBalance = roundMoney(wallet.availableBalance + toSafeNumber(changes.availableDelta, 0));
  wallet.pendingBalance = roundMoney(wallet.pendingBalance + toSafeNumber(changes.pendingDelta, 0));
  if (wallet.availableBalance < 0 || wallet.pendingBalance < 0) {
    throw new Error("Insufficient wallet balance");
  }
  return await saveWallet(wallet);
}

// Map a Fapshi transaction id to a payout/withdrawal record so the webhook can
// reconcile its final status. Only meaningful for real Fapshi (mock has no txId).
async function indexFapshiPayout(payoutResult: any, withdrawalId: string) {
  if (payoutResult?.provider === "fapshi" && payoutResult?.reference) {
    await kv.set(`fapshi:tx:${payoutResult.reference}`, {
      type: "payout",
      withdrawalId,
      createdAt: new Date().toISOString(),
    });
  }
}

// Reconcile a payout's final status from a verified Fapshi webhook. Idempotent:
// it only acts while the withdrawal is still PROCESSING. On FAILED/EXPIRED it
// refunds the amount back to the user's available balance exactly once.
async function reconcileFapshiPayout(withdrawalId: string, status: string, raw: any) {
  const withdrawal = await kv.get(`withdrawal:${withdrawalId}`);
  if (!withdrawal) return null;
  if (withdrawal.status !== WITHDRAWAL_STATUS.PROCESSING) {
    return { withdrawal, skipped: true };
  }
  const now = new Date().toISOString();

  if (status === "successful") {
    const updated = {
      ...withdrawal,
      status: WITHDRAWAL_STATUS.COMPLETED,
      providerStatus: status,
      providerPayload: raw ?? withdrawal.providerPayload,
      updatedAt: now,
    };
    await kv.set(`withdrawal:${withdrawalId}`, updated);
    await recordPaymentAudit("payout_completed", { withdrawalId, amount: withdrawal.amount });
    return { withdrawal: updated, completed: true };
  }

  if (status === "failed" || status === "expired") {
    // Refund the held amount back to the user — the money never left.
    if (!withdrawal.walletRefunded && withdrawal.userId && withdrawal.amount > 0) {
      try {
        await adjustWallet(withdrawal.userId, { availableDelta: roundXafAmount(withdrawal.amount) });
      } catch (refundError) {
        console.error("Failed to refund failed payout to wallet:", refundError);
      }
    }
    const updated = {
      ...withdrawal,
      status: WITHDRAWAL_STATUS.FAILED,
      providerStatus: status,
      providerPayload: raw ?? withdrawal.providerPayload,
      walletRefunded: true,
      updatedAt: now,
    };
    await kv.set(`withdrawal:${withdrawalId}`, updated);
    await recordPaymentAudit("payout_failed", { withdrawalId, amount: withdrawal.amount, status });
    return { withdrawal: updated, failed: true };
  }

  return { withdrawal, pending: true };
}

const sortByCreatedDesc = (a: any, b: any) =>
  String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""));

async function createUserNotification(
  userId: string,
  payload: {
    type: string;
    title: string;
    message: string;
    priority?: "normal" | "high" | "urgent";
    data?: Record<string, any>;
  },
) {
  if (!userId) return null;
  const id = createEntityId("NOTIF");
  const now = new Date().toISOString();
  const notification = {
    id,
    userId,
    type: payload.type || "general",
    title: payload.title || "Notification",
    message: payload.message || "",
    priority: payload.priority || "normal",
    data: payload.data || {},
    read: false,
    readAt: "",
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(`notification:${id}`, notification);
  const userNotificationIds = (await kv.get(`user:${userId}:notifications`)) || [];
  userNotificationIds.unshift(id);
  if (userNotificationIds.length > 500) {
    userNotificationIds.length = 500;
  }
  await kv.set(`user:${userId}:notifications`, userNotificationIds);
  return notification;
}

async function createNotificationsForUsers(
  userIds: string[],
  payload: {
    type: string;
    title: string;
    message: string;
    priority?: "normal" | "high" | "urgent";
    data?: Record<string, any>;
  },
) {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  await Promise.all(uniqueIds.map(async (userId) => await createUserNotification(userId, payload)));
}

async function notifyAdmins(payload: {
  type: string;
  title: string;
  message: string;
  priority?: "normal" | "high" | "urgent";
  data?: Record<string, any>;
}) {
  const users = await kv.getByPrefix("user:");
  const admins = (users || []).filter((u: any) => u?.role === "admin" && typeof u?.id === "string");
  await createNotificationsForUsers(
    admins.map((admin: any) => admin.id),
    payload,
  );
}

function buildLegacyTransaction(order: any) {
  const transactionFee = roundMoney(order.transactionFee || 0);
  const totalCharged = roundMoney(order.totalCharged || order.amount || 0);
  const releasedPlatformFee = order?.releasedAt || order?.status === ORDER_STATUS.DELIVERED_RELEASED
    ? roundMoney(order.platformFee || 0)
    : 0;
  const platformRevenue = roundMoney(transactionFee + releasedPlatformFee);
  return {
    id: order.id,
    orderId: order.id,
    escrowId: order.escrowId,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    itemId: order.itemId,
    amount: order.amount,
    paymentMethod: order.paymentMethod,
    phoneNumber: order.phoneNumber,
    transactionFee,
    totalCharged,
    platformFee: releasedPlatformFee,
    platformRevenue,
    transactionRef: order.transactionRef,
    pickupDate: order.pickupDate,
    pickupTime: order.pickupTime,
    pickupLocation: order.pickupLocation,
    status: order.status,
    statusLabel: normalizeOrderStatusLabel(order.status),
    transactionType: "order",
    timestamp: order.createdAt,
    createdAt: order.createdAt,
    releasedAt: order.releasedAt || null,
    refundedAt: order.refundedAt || null,
  };
}

function buildSubscriptionTransaction(payment: any) {
  const createdAt = typeof payment?.createdAt === "string" ? payment.createdAt : new Date().toISOString();
  const amount = roundMoney(payment?.amount || 0);
  const transactionFee = roundMoney(payment?.transactionFee || 0);
  const totalCharged = roundMoney(payment?.totalCharged || amount + transactionFee);
  return {
    id: typeof payment?.id === "string" && payment.id ? payment.id : createEntityId("SUBPAY"),
    orderId: "",
    escrowId: "",
    buyerId: payment?.userId || "",
    sellerId: ADMIN_WALLET_USER_ID,
    itemId: "",
    amount,
    paymentMethod: payment?.paymentMethod || "",
    phoneNumber: payment?.phoneNumber || "",
    transactionFee,
    totalCharged,
    platformFee: totalCharged,
    platformRevenue: totalCharged,
    transactionRef: payment?.providerReference || "",
    pickupDate: "",
    pickupTime: "",
    pickupLocation: "",
    status: "subscription_active",
    statusLabel: "SUBSCRIPTION ACTIVE",
    transactionType: "subscription",
    plan: payment?.plan || "",
    userType: payment?.userType || "",
    merchantName: payment?.merchantName || MERCHANT_MOMO_NAME,
    merchantNumber: payment?.merchantNumber || MERCHANT_MOMO_NUMBER,
    provider: payment?.provider || "",
    providerStatus: payment?.providerStatus || "",
    timestamp: createdAt,
    createdAt,
    releasedAt: createdAt,
    refundedAt: null,
  };
}

// Activate a subscription once its Fapshi payment is confirmed. Idempotent:
// no-ops (and never double-credits the platform wallet) if already active.
async function activateSubscriptionFromPayment(paymentId: string) {
  const payment = await kv.get(`subscription_payment:${paymentId}`);
  if (!payment) return null;
  if (payment.status === "active") {
    return { payment, alreadyActive: true, user: await getUserProfile(payment.userId) };
  }
  const profile = await getUserProfile(payment.userId);
  if (!profile) return null;

  const now = new Date();
  const nowIso = now.toISOString();
  const endDate = new Date(now.getTime());
  if (payment.plan === "yearly") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  const updatedProfile = {
    ...profile,
    phone: payment.phoneNumber || profile.phone,
    subscriptionStatus: "active",
    subscriptionPlan: payment.plan,
    subscriptionStartDate: nowIso,
    subscriptionEndDate: endDate.toISOString(),
    subscriptionPaymentMethod: payment.paymentMethod,
    subscriptionPhoneNumber: payment.phoneNumber,
    subscriptionAmount: payment.amount,
    subscriptionTransactionFee: payment.transactionFee,
    subscriptionTotalCharged: payment.totalCharged,
    subscriptionReference: payment.providerReference,
    subscriptionUpdatedAt: nowIso,
  };
  await kv.set(`user:${payment.userId}`, updatedProfile);
  await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: roundXafAmount(payment.totalCharged) });

  const activePayment = { ...payment, status: "active", providerStatus: "successful", activatedAt: nowIso };
  await kv.set(`subscription_payment:${paymentId}`, activePayment);
  await kv.set(`transaction:${paymentId}`, buildSubscriptionTransaction(activePayment));
  await recordPaymentAudit("subscription_activated", {
    paymentId,
    userId: payment.userId,
    amount: payment.totalCharged,
  });
  return { user: updatedProfile, payment: activePayment };
}

// Mark a subscription payment failed/expired (no activation, no wallet credit).
async function failSubscriptionPayment(paymentId: string, reason: string) {
  const payment = await kv.get(`subscription_payment:${paymentId}`);
  if (!payment || payment.status === "active") return null;
  const failed = { ...payment, status: "failed", providerStatus: reason, updatedAt: new Date().toISOString() };
  await kv.set(`subscription_payment:${paymentId}`, failed);
  await recordPaymentAudit("subscription_failed", { paymentId, userId: payment.userId, reason });
  return { payment: failed, failed: true };
}

async function buildPayoutSummaries() {
  const settings = await getAdminSettings();
  const minPayoutAmount = Math.max(0, toSafeNumber(settings.minimumPayoutAmount, 1000));

  const allUsers = await kv.getByPrefix("user:");
  const sellers = (allUsers || []).filter((profile: any) =>
    profile &&
    typeof profile === "object" &&
    profile.role !== "admin" &&
    profile.userType === "seller" &&
    typeof profile.id === "string",
  );

  const allOrders = await kv.getByPrefix("order:");
  const allWithdrawals = await kv.getByPrefix("withdrawal:");

  const payouts = await Promise.all(
    sellers.map(async (seller: any) => {
      const sellerOrders = (allOrders || []).filter((order: any) => order?.sellerId === seller.id);
      const releasedOrders = sellerOrders.filter((order: any) => order?.status === ORDER_STATUS.DELIVERED_RELEASED);
      const completedWithdrawals = (allWithdrawals || []).filter(
        (withdrawal: any) =>
          withdrawal?.userId === seller.id &&
          (withdrawal.status === WITHDRAWAL_STATUS.COMPLETED || withdrawal.status === WITHDRAWAL_STATUS.PROCESSING),
      );

      const wallet = await getWallet(seller.id);
      const grossAmount = roundMoney(sellerOrders.reduce((sum: number, order: any) => sum + toSafeNumber(order?.amount), 0));
      const platformFee = roundMoney(
        releasedOrders.reduce((sum: number, order: any) => sum + toSafeNumber(order?.platformFee), 0),
      );
      const netAmount = roundMoney(
        releasedOrders.reduce((sum: number, order: any) => sum + toSafeNumber(order?.sellerNetAmount), 0),
      );
      const paidAmount = roundMoney(
        completedWithdrawals.reduce((sum: number, withdrawal: any) => sum + toSafeNumber(withdrawal?.amount), 0),
      );
      const pendingAmount = roundMoney(wallet.availableBalance);
      const canBePaid = pendingAmount >= minPayoutAmount;

      let status: "pending" | "partial" | "paid" = "paid";
      if (pendingAmount > 0 && paidAmount > 0) {
        status = "partial";
      } else if (pendingAmount > 0) {
        status = "pending";
      }

      const latestPayout = completedWithdrawals
        .slice()
        .sort((a: any, b: any) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")))[0];

      return {
        sellerId: seller.id,
        sellerName: seller.name || "Unknown Seller",
        sellerEmail: seller.email || "",
        transactionCount: sellerOrders.length,
        grossAmount,
        platformFee,
        netAmount,
        paidAmount,
        pendingAmount,
        canBePaid,
        status,
        lastPaidAt: latestPayout?.updatedAt || null,
        lastPaidAmount: roundMoney(latestPayout?.amount || 0),
      };
    }),
  );

  payouts.sort((a, b) => {
    if (a.pendingAmount > 0 && b.pendingAmount === 0) return -1;
    if (a.pendingAmount === 0 && b.pendingAmount > 0) return 1;
    return b.pendingAmount - a.pendingAmount;
  });

  return { payouts, settings };
}

async function getPlatformRevenueWithdrawals() {
  const allWithdrawals = (await kv.getByPrefix("withdrawal:")) || [];
  return (allWithdrawals || [])
    .filter((withdrawal: any) => {
      if (!withdrawal || typeof withdrawal !== "object") return false;
      if (withdrawal.userId === ADMIN_WALLET_USER_ID) return true;
      return withdrawal.source === "admin-platform-withdrawal";
    })
    .sort((a: any, b: any) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
}

async function getPlatformRevenueWalletSummary() {
  const wallet = await getWallet(ADMIN_WALLET_USER_ID);
  const withdrawals = await getPlatformRevenueWithdrawals();
  const totalWithdrawn = roundMoney(
    withdrawals.reduce((sum: number, withdrawal: any) => {
      const status = String(withdrawal?.status || "").toLowerCase();
      if (status === WITHDRAWAL_STATUS.COMPLETED || status === WITHDRAWAL_STATUS.PROCESSING) {
        return sum + toSafeNumber(withdrawal?.amount, 0);
      }
      return sum;
    }, 0),
  );

  return {
    wallet,
    withdrawableBalance: roundMoney(wallet.availableBalance),
    pendingBalance: roundMoney(wallet.pendingBalance),
    totalWithdrawn,
    withdrawals: withdrawals.slice(0, 30),
  };
}

const normalizeAuthTokenInput = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  let token = String(value).trim().replace(/^"(.*)"$/, "$1").trim();
  for (let i = 0; i < 2; i += 1) {
    if (!/^bearer\s+/i.test(token)) break;
    token = token.replace(/^bearer\s+/i, "").trim();
  }
  if (!token || token.toLowerCase() === "null" || token.toLowerCase() === "undefined") {
    return "";
  }
  return token;
};

const extractBearerToken = (headerValue: string | null | undefined) => {
  if (!headerValue) {
    return "";
  }
  const match = String(headerValue).trim().match(/^bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return "";
  }
  return normalizeAuthTokenInput(match[1]);
};

const verifyRefreshTokenUser = async (rawRefreshToken: string | null | undefined) => {
  const refreshToken = normalizeAuthTokenInput(rawRefreshToken);
  if (!refreshToken) {
    return null;
  }
  const refreshSession = await getValidSession(refreshToken, "refresh");
  if (!refreshSession?.userId) {
    return null;
  }
  return {
    id: refreshSession.userId,
    email: refreshSession.email,
  };
};

// Helper function to verify auth token
async function verifyAuth(authHeader: string | null | undefined) {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return null;
  }

  const session = await getValidSession(token, "access");
  if (!session) {
    return null;
  }

  return {
    id: session.userId,
    email: session.email,
  };
}

// Messaging endpoints can accept a valid refresh token as fallback when
// access tokens are stale to avoid call/signaling interruption loops.
async function verifyMessagingAuth(
  authHeader: string | null | undefined,
  refreshTokenHeader: string | null | undefined,
) {
  const accessUser = await verifyAuth(authHeader);
  if (accessUser) {
    return accessUser;
  }

  return await verifyRefreshTokenUser(refreshTokenHeader);
}

// Helper function to get user profile
async function getUserProfile(userId: string) {
  const key = `user:${userId}`;
  const profile = await kv.get(key);
  if (!profile) {
    return null;
  }

  const normalizedProfile = normalizeUserProfile(profile);
  if (!normalizedProfile) {
    return null;
  }

  const needsNormalization =
    !profile.createdAt ||
    (profile.userType !== 'buyer' && profile.userType !== 'seller') ||
    typeof profile.profilePicture !== 'string' ||
    profile.avatar !== normalizedProfile.avatar ||
    typeof profile.isBanned !== 'boolean';

  if (needsNormalization) {
    await kv.set(key, normalizedProfile);
  }

  return normalizedProfile;
}

const LEGACY_UNAVAILABLE_IMAGE_HOSTS = new Set([
  "gidhrctnjfxzccaplkjj.supabase.co",
]);

const isLegacyUnavailableUrl = (url: string) => {
  if (!url) return false;
  try {
    return LEGACY_UNAVAILABLE_IMAGE_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
};

const DEFAULT_LISTING_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800";

const LISTING_CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
  "1": [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800",
    "https://images.unsplash.com/photo-1616594039964-3cb65d0f1f3c?w=800",
  ],
  "2": [
    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800",
    "https://images.unsplash.com/photo-1582582429416-3f57c8a8f6af?w=800",
  ],
  "3": [
    "https://images.unsplash.com/photo-1543353071-873f17a7a088?w=800",
    "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800",
  ],
  "4": [
    "https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?w=800",
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800",
  ],
  "5": [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
  ],
  "6": [
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800",
    "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800",
  ],
};

const pickFallbackListingImage = (listing: any) => {
  const categoryId = String(listing?.category || "").trim();
  const candidates = LISTING_CATEGORY_FALLBACK_IMAGES[categoryId] || [DEFAULT_LISTING_FALLBACK_IMAGE];
  const seed = String(listing?.id || listing?.title || categoryId || "listing");

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const itemIndex = Math.abs(hash) % candidates.length;
  return candidates[itemIndex] || DEFAULT_LISTING_FALLBACK_IMAGE;
};

const normalizeListingImages = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];
  for (const entry of value) {
    const imageUrl = typeof entry === "string" ? entry.trim() : "";
    if (!imageUrl) {
      continue;
    }

    try {
      const host = new URL(imageUrl).hostname.toLowerCase();
      if (LEGACY_UNAVAILABLE_IMAGE_HOSTS.has(host)) {
        continue;
      }
    } catch {
      // Keep relative/local URLs as-is.
    }

    normalized.push(imageUrl);
  }

  return normalized;
};

async function enrichListing(listing: any, sellerCache?: Map<string, any | null>) {
  if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
    return listing;
  }

  const availableImages = normalizeListingImages(listing.images);

  const normalizedListing = {
    ...listing,
    views: Math.max(0, toSafeNumber(listing.views, 0)),
    likesCount: Math.max(0, toSafeNumber(listing.likesCount, 0)),
    images: availableImages.length > 0 ? availableImages : [pickFallbackListingImage(listing)],
  };

  if (!normalizedListing.sellerId || typeof normalizedListing.sellerId !== 'string') {
    return normalizedListing;
  }

  let seller: any | null | undefined =
    sellerCache ? sellerCache.get(normalizedListing.sellerId) : undefined;

  if (typeof seller === 'undefined') {
    seller = await getUserProfile(normalizedListing.sellerId);
    if (sellerCache) {
      sellerCache.set(normalizedListing.sellerId, seller || null);
    }
  }

  if (!seller) {
    return normalizedListing;
  }

  return {
    ...normalizedListing,
    seller: {
      id: seller.id,
      name: seller.name,
      email: seller.email,
      phone: seller.phone,
      rating: seller.rating,
      reviewCount: seller.reviewCount,
      isVerified: seller.isVerified,
      university: seller.university,
      profilePicture: seller.profilePicture || '',
    },
  };
}

const normalizeAiText = (value: unknown, maxLength = 4000) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return "";
  }
  return text.slice(0, maxLength);
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

type AiDailyUsageSnapshot = {
  subjectId: string;
  dayKey: string;
  used: number;
  remaining: number;
  limit: number;
  storageKey: string;
  timeZone: string;
  windowStartedAt: string;
  windowEndsAt: string;
  windowMs: number;
};

const toAiUsageCount = (value: any) => {
  const candidate = typeof value === "number" ? value : toSafeNumber(value?.count, 0);
  if (!Number.isFinite(candidate)) {
    return 0;
  }
  return Math.max(0, Math.trunc(candidate));
};

const parseIsoDateMs = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return Number.NaN;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const firstFiniteNumber = (...values: number[]) => {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return Number.NaN;
};

const getDatePartsForTimeZone = (date: Date, timeZone: string) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) {
      return { year, month, day };
    }
  } catch {
    // Fallback to UTC if timezone configuration is invalid.
  }

  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return { year, month, day };
};

const getAiDailyUsageDayKey = (date = new Date()) => {
  const { year, month, day } = getDatePartsForTimeZone(date, AI_DAILY_LIMIT_TIMEZONE);
  return `${year}-${month}-${day}`;
};

const getClientIpFromRequest = (req: Request) => {
  const directHeaders = ["cf-connecting-ip", "x-real-ip"];
  for (const headerName of directHeaders) {
    const headerValue = normalizeAiText(req.headers.get(headerName), 120);
    if (headerValue) {
      return headerValue;
    }
  }

  const forwardedFor = normalizeAiText(req.headers.get("x-forwarded-for"), 300);
  if (forwardedFor) {
    const firstAddress = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
    if (firstAddress) {
      return firstAddress;
    }
  }

  const forwarded = normalizeAiText(req.headers.get("forwarded"), 500);
  if (forwarded) {
    const match = forwarded.match(/for="?([^;,\s"]+)/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
};

const getGuestAiIdFromRequest = (req: Request) => {
  const raw = normalizeAiText(req.headers.get("x-ai-guest-id"), 120);
  if (!raw) {
    return "";
  }
  return /^[A-Za-z0-9._:-]{8,120}$/.test(raw) ? raw : "";
};

const toPublicAiUsageSnapshot = (snapshot: AiDailyUsageSnapshot) => ({
  dayKey: snapshot.dayKey,
  limit: snapshot.limit,
  used: snapshot.used,
  remaining: snapshot.remaining,
  timeZone: snapshot.timeZone,
  windowStartedAt: snapshot.windowStartedAt,
  windowEndsAt: snapshot.windowEndsAt,
  windowMs: snapshot.windowMs,
});

async function resolveAiUsageSubjectId(req: Request, userId?: string) {
  const normalizedUserId = normalizeAiText(userId, 120);
  if (normalizedUserId) {
    return `user:${normalizedUserId}`;
  }

  const guestId = getGuestAiIdFromRequest(req);
  if (guestId) {
    return `guest:${guestId}`;
  }

  const clientIp = getClientIpFromRequest(req);
  const userAgent = normalizeAiText(req.headers.get("user-agent"), 240);
  const fingerprint = `${clientIp || "unknown-ip"}|${userAgent || "unknown-user-agent"}`;
  const fingerprintHash = await sha256Hex(fingerprint);
  return `anon:${fingerprintHash.slice(0, 32)}`;
}

async function getAiDailyUsageSnapshot(req: Request, userId?: string) {
  const subjectId = await resolveAiUsageSubjectId(req, userId);
  const storageKey = aiDailyUsageKey(subjectId);
  const usageRecord = await kv.get(storageKey);
  const nowMs = Date.now();
  const storedStartedAtMs = firstFiniteNumber(
    parseIsoDateMs(usageRecord?.windowStartedAt),
    parseIsoDateMs(usageRecord?.startedAt),
    parseIsoDateMs(usageRecord?.updatedAt),
  );
  const isExpired = !Number.isFinite(storedStartedAtMs) || (nowMs - storedStartedAtMs) >= AI_CHAT_LIMIT_WINDOW_MS;
  const windowStartedAtMs = isExpired ? nowMs : storedStartedAtMs;
  const windowEndsAtMs = windowStartedAtMs + AI_CHAT_LIMIT_WINDOW_MS;
  const used = isExpired ? 0 : toAiUsageCount(usageRecord);
  const dayKey = getAiDailyUsageDayKey(new Date(windowStartedAtMs));

  return {
    subjectId,
    dayKey,
    used,
    remaining: Math.max(0, AI_CHAT_DAILY_LIMIT - used),
    limit: AI_CHAT_DAILY_LIMIT,
    storageKey,
    timeZone: AI_DAILY_LIMIT_TIMEZONE,
    windowStartedAt: new Date(windowStartedAtMs).toISOString(),
    windowEndsAt: new Date(windowEndsAtMs).toISOString(),
    windowMs: AI_CHAT_LIMIT_WINDOW_MS,
  } satisfies AiDailyUsageSnapshot;
}

async function incrementAiDailyUsage(snapshot: AiDailyUsageSnapshot) {
  const updatedUsage = {
    ...snapshot,
    used: snapshot.used + 1,
  };

  const nextSnapshot = {
    ...updatedUsage,
    remaining: Math.max(0, updatedUsage.limit - updatedUsage.used),
  };

  await kv.set(snapshot.storageKey, {
    subjectId: snapshot.subjectId,
    dayKey: snapshot.dayKey,
    count: nextSnapshot.used,
    windowStartedAt: snapshot.windowStartedAt,
    windowEndsAt: snapshot.windowEndsAt,
    windowMs: snapshot.windowMs,
    updatedAt: new Date().toISOString(),
  });

  return nextSnapshot;
}

const normalizeAiLocation = (value: any) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const city = normalizeAiText(value.city, 120);
  const university = normalizeAiText(value.university, 120);
  const country = normalizeAiText(value.country, 120);
  const latitude = toSafeNumber(value.latitude, NaN);
  const longitude = toSafeNumber(value.longitude, NaN);

  return {
    city: city || "",
    university: university || "",
    country: country || "",
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
};

const normalizeAiHistoryEntries = (value: any, limit = AI_CHAT_HISTORY_LIMIT) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry: any) => {
      const role = entry?.role === "assistant" ? "assistant" : "user";
      const content = normalizeAiText(entry?.content, 4000);
      if (!content) {
        return null;
      }
      const createdAt = typeof entry?.createdAt === "string" && entry.createdAt
        ? entry.createdAt
        : new Date().toISOString();
      return {
        id: typeof entry?.id === "string" && entry.id ? entry.id : createEntityId("AIMSG"),
        role,
        content,
        createdAt,
      };
    })
    .filter(Boolean)
    .slice(-Math.max(10, limit));
};

const normalizeAiConversationId = (value: unknown) =>
  normalizeAiText(value, 120).replace(/[^A-Za-z0-9._:-]/g, "");

const buildAiConversationTitleFromMessages = (messages: any[]) => {
  const firstUserMessage = messages.find((entry: any) =>
    entry?.role === "user" && isNonEmptyString(entry?.content)
  );
  const fallbackMessage = messages.find((entry: any) => isNonEmptyString(entry?.content));
  const source = normalizeAiText(firstUserMessage?.content || fallbackMessage?.content || "", 120);
  if (!source) {
    return "New chat";
  }
  return source.length > 60 ? `${source.slice(0, 57)}...` : source;
};

const normalizeAiConversationTitle = (value: unknown, messages: any[]) => {
  const explicitTitle = normalizeAiText(value, 120);
  if (explicitTitle) {
    return explicitTitle;
  }
  return buildAiConversationTitleFromMessages(messages);
};

const normalizeAiConversationEntries = (value: any, limit = AI_CHAT_CONVERSATION_LIMIT) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((entry: any) => {
      const messages = normalizeAiHistoryEntries(entry?.messages);
      const createdAt = isNonEmptyString(entry?.createdAt)
        ? entry.createdAt
        : (messages[0]?.createdAt || new Date().toISOString());
      const updatedAt = isNonEmptyString(entry?.updatedAt)
        ? entry.updatedAt
        : (messages[messages.length - 1]?.createdAt || createdAt);

      return {
        id: normalizeAiConversationId(entry?.id) || createEntityId("AITHR"),
        title: normalizeAiConversationTitle(entry?.title, messages),
        createdAt,
        updatedAt,
        messages,
      };
    })
    .filter(Boolean);

  const deduped = new Map<string, any>();
  for (const entry of normalized) {
    const current = deduped.get(entry.id);
    if (!current) {
      deduped.set(entry.id, entry);
      continue;
    }
    const nextUpdatedAt = Date.parse(entry.updatedAt);
    const currentUpdatedAt = Date.parse(current.updatedAt);
    if (Number.isFinite(nextUpdatedAt) && (!Number.isFinite(currentUpdatedAt) || nextUpdatedAt >= currentUpdatedAt)) {
      deduped.set(entry.id, entry);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt);
      const rightTime = Date.parse(right.updatedAt);
      const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
      return safeRight - safeLeft;
    })
    .slice(0, Math.max(1, limit));
};

const buildLegacyAiConversation = (history: any) => {
  const messages = normalizeAiHistoryEntries(history);
  if (messages.length === 0) {
    return null;
  }

  const createdAt = messages[0]?.createdAt || new Date().toISOString();
  const updatedAt = messages[messages.length - 1]?.createdAt || createdAt;
  return {
    id: createEntityId("AITHR"),
    title: normalizeAiConversationTitle("", messages),
    createdAt,
    updatedAt,
    messages,
  };
};

const normalizeAiConversationsForUser = (storedConversations: any, legacyHistory: any) => {
  const normalizedConversations = normalizeAiConversationEntries(storedConversations);
  if (normalizedConversations.length > 0) {
    return normalizedConversations;
  }

  const legacyConversation = buildLegacyAiConversation(legacyHistory);
  return legacyConversation ? [legacyConversation] : [];
};

const upsertAiConversation = (conversations: any[], nextConversation: any) => {
  const normalizedConversation = normalizeAiConversationEntries([nextConversation])[0];
  if (!normalizedConversation) {
    return normalizeAiConversationEntries(conversations);
  }

  const filtered = normalizeAiConversationEntries(conversations).filter(
    (entry: any) => entry.id !== normalizedConversation.id,
  );

  return normalizeAiConversationEntries([normalizedConversation, ...filtered]);
};

const extractDataUrlImages = (value: any) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item: any) => normalizeAiText(item, 2_000_000))
    .filter((item: string) => item.startsWith("data:image/"))
    .slice(0, AI_MAX_USER_IMAGES);
};

const extractSearchTokens = (text: string) =>
  Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3),
    ),
  );

const parseBudgetFromText = (text: string) => {
  const matches = Array.from(String(text || "").matchAll(/(\d[\d\s,._]{1,12})/g));
  const parsed = matches
    .map((match) => Number.parseInt(match[1].replace(/[^\d]/g, ""), 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.trunc(value));

  if (!parsed.length) {
    return null;
  }

  const max = Math.max(...parsed);
  const min = Math.min(...parsed);
  return {
    min,
    max,
  };
};

const KNOWN_STYLE_KEYWORDS = [
  "minimalist",
  "modern",
  "cozy",
  "scandinavian",
  "bohemian",
  "boho",
  "industrial",
  "classic",
  "luxury",
  "rustic",
  "simple",
];

const detectStyleFromText = (text: string) => {
  const normalized = String(text || "").toLowerCase();
  for (const keyword of KNOWN_STYLE_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return keyword;
    }
  }
  return "";
};

const detectPrimaryIntent = (text: string) => {
  const normalized = String(text || "").toLowerCase().trim();

  // Greetings and conversational openers — never show products
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|good night|bonjour|salut|bonsoir|yo|sup|hiya|howdy|greetings|cava|ça va|morning|evening|afternoon|night)[\s!?.,:]*$/.test(normalized)) {
    return "greeting";
  }
  // "How are you" variations — always a greeting
  if (/^how are you|^how r u|^how are u|^how do you do|^how is it going|^how are things|^how are you doing|^how have you been|^what's up|^whats up|^how's it going|^hows it going|^you good|^u good/.test(normalized)) {
    return "greeting";
  }
  // Short casual messages that are clearly conversational
  if (/^(ok|okay|yes|yeah|no|nope|sure|cool|great|nice|thanks|thank you|merci|bye|goodbye|see you|later|lol|haha|😊|👋)[\s!?.]*$/.test(normalized)) {
    return "greeting";
  }

  // General knowledge / question — never show products
  if (/^(what|how|why|when|who|where|which|explain|define|tell me|describe|can you|could you|difference between|is it|are there|do you know|what is|what are|how does|how do|why is|why does)/.test(normalized)) {
    return "general_qa";
  }

  // Shopping intents — show products
  if (/(room|decorate|decor|arrange|style|bedroom|living room|parlor|sitting room)/.test(normalized)) {
    return "room_setup";
  }
  if (/(kitchen|cookware|pots|utensils|fridge|stove|kettle|cook)/.test(normalized)) {
    return "kitchen_setup";
  }
  if (/(cheaper|affordable|budget|lower price|less expensive)/.test(normalized)) {
    return "cheaper_alternatives";
  }
  if (/(similar|like this|related)/.test(normalized)) {
    return "similar_items";
  }
  if (/(buy|purchase|sell|rent|find|need|looking for|i want|i need|show me|recommend|suggest|price|cost|how much|laptop|phone|furniture|mattress|desk|chair|textbook|fridge|fan)/.test(normalized)) {
    return "product_recommendation";
  }

  // Default: treat as general conversation, NOT a product search
  return "general_qa";
};

const mergeAiPreferences = (previous: any, updates: any) => {
  const next = {
    budgetMin: Math.max(0, toSafeNumber(previous?.budgetMin, 0)),
    budgetMax: Math.max(0, toSafeNumber(previous?.budgetMax, 0)),
    preferredStyle: normalizeAiText(previous?.preferredStyle, 80),
    preferredCity: normalizeAiText(previous?.preferredCity, 80),
    preferredUniversity: normalizeAiText(previous?.preferredUniversity, 120),
    lastIntent: normalizeAiText(previous?.lastIntent, 80),
    updatedAt: typeof previous?.updatedAt === "string" && previous.updatedAt ? previous.updatedAt : new Date().toISOString(),
  };

  if (updates?.budgetMin !== undefined) {
    next.budgetMin = Math.max(0, toSafeNumber(updates.budgetMin, next.budgetMin));
  }
  if (updates?.budgetMax !== undefined) {
    next.budgetMax = Math.max(0, toSafeNumber(updates.budgetMax, next.budgetMax));
  }
  if (isNonEmptyString(updates?.preferredStyle)) {
    next.preferredStyle = normalizeAiText(updates.preferredStyle, 80);
  }
  if (isNonEmptyString(updates?.preferredCity)) {
    next.preferredCity = normalizeAiText(updates.preferredCity, 80);
  }
  if (isNonEmptyString(updates?.preferredUniversity)) {
    next.preferredUniversity = normalizeAiText(updates.preferredUniversity, 120);
  }
  if (isNonEmptyString(updates?.lastIntent)) {
    next.lastIntent = normalizeAiText(updates.lastIntent, 80);
  }

  next.updatedAt = new Date().toISOString();
  return next;
};

const normalizeAiAnalyticsEvents = (value: any) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry: any) => {
      const eventType = normalizeAiText(entry?.eventType, 80);
      const itemId = normalizeAiText(entry?.itemId, 120);
      if (!eventType || !itemId) {
        return null;
      }
      return {
        id: isNonEmptyString(entry?.id) ? entry.id : createEntityId("AIEVT"),
        eventType,
        itemId,
        createdAt: isNonEmptyString(entry?.createdAt) ? entry.createdAt : new Date().toISOString(),
        metadata: entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
      };
    })
    .filter(Boolean)
    .slice(-500);
};

const listingTextValue = (listing: any) =>
  [
    String(listing?.title || ""),
    String(listing?.description || ""),
    String(listing?.category || ""),
    String(listing?.location || ""),
    String(listing?.seller?.university || ""),
  ].join(" ").toLowerCase();

const scoreListingForQuery = (
  listing: any,
  tokens: string[],
  location: { city?: string; university?: string } | null,
  budget: { min: number; max: number } | null,
) => {
  const text = listingTextValue(listing);
  let score = 0;

  if (!listing || listing.status !== "available") {
    return Number.NEGATIVE_INFINITY;
  }

  for (const token of tokens) {
    if (text.includes(token)) {
      score += 5;
    }
  }

  const price = Math.max(0, toSafeNumber(listing?.price, 0));
  if (budget?.max && price > 0) {
    if (price <= budget.max) {
      score += 8;
    } else {
      const overBy = Math.max(0, price - budget.max);
      score -= Math.min(12, overBy / Math.max(1, budget.max) * 20);
    }
    if (budget.min && price >= budget.min) {
      score += 3;
    }
  }

  const locationSignals = [
    normalizeAiText(location?.city || "", 80).toLowerCase(),
    normalizeAiText(location?.university || "", 80).toLowerCase(),
  ].filter(Boolean);

  for (const signal of locationSignals) {
    if (text.includes(signal)) {
      score += 6;
    }
  }

  score += Math.min(4, toSafeNumber(listing?.likesCount, 0) / 8);
  score += Math.min(3, toSafeNumber(listing?.views, 0) / 40);
  score += Math.min(4, toSafeNumber(listing?.seller?.rating, 0));

  if (listing?.type === "rent") {
    score += 1;
  }

  return score;
};

async function getAvailableListingsForAi() {
  let listings = await kv.getByPrefix("listing:");
  if (Array.isArray(listings)) {
    listings = listings.filter((listing: any) => !isDemoMarketplaceListing(listing));
  }

  const sellerCache = new Map<string, any | null>();
  const enriched: any[] = [];

  for (const listing of listings || []) {
    if (!listing || typeof listing !== "object" || Array.isArray(listing)) {
      continue;
    }

    const normalized = await enrichListing(listing, sellerCache);
    if (normalized?.status === "available") {
      enriched.push(normalized);
    }
  }

  return enriched;
}

const parseJsonFromModelText = (text: string) => {
  const direct = normalizeAiText(text, 120_000);
  if (!direct) {
    return null;
  }

  try {
    return JSON.parse(direct);
  } catch {
    // Fallback for model responses wrapped in markdown fences.
  }

  const match = direct.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const buildFallbackAssistantMessage = (recommendedCount: number, intent = "") => {
  if (intent === "greeting") {
    const greetings = [
      "I'm doing great, thanks for asking! 😊 How can I help you today?",
      "I'm fine, thank you! 😄 What can I do for you?",
      "Doing well, thanks! 👋 What's on your mind today?",
      "Great, thanks for asking! 😊 Ready to help — what do you need?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  if (intent === "general_qa" || intent === "student_advice" || intent === "career_advice") {
    return "That's a great question! 😊 I'm Sasha, your Campus Market assistant. I can help you with general questions, product recommendations, room setup ideas, kitchen essentials, study tips, and much more. What would you like to know?";
  }
  if (intent === "kitchen_list" || intent === "kitchen_setup") {
    return "Here are some essentials students usually buy for their kitchen 🍳\n\n• Gas stove or electric hotplate\n• Cooking pots (large + medium)\n• Frying pan\n• Electric kettle\n• Plates, bowls and cups\n• Cutlery set (fork, knife, spoon)\n• Cutting board and knife\n• Food storage containers\n• Blender\n• Dish rack\n\nWould you like me to search Campus Market for any of these? Tell me your budget and city! 😊";
  }
  if (intent === "room_setup") {
    return "Here are the essentials for setting up a student room 🛋️\n\n• Mattress or foam\n• Study desk and chair\n• Wardrobe or storage shelves\n• Desk lamp\n• Bedsheets, pillow and blanket\n• Curtains\n• Small rug\n• Mirror\n\nTell me your budget and city and I'll find matching items on Campus Market! 😊";
  }
  if (recommendedCount > 0) {
    return "Here are some products from Campus Market that match your request! 🛍️ Let me know your budget or city and I'll narrow it down further.";
  }
  return "I didn't find exact matches right now, but I can help! 😊 Try being more specific — for example: 'I need a laptop under 100,000 XAF in Buea' or 'show me kitchen items under 50,000 XAF'.";
};

const buildDefaultRecommendationReason = (listing: any) => {
  const parts: string[] = [];
  if (listing?.price) {
    parts.push(`priced at ${toSafeNumber(listing.price, 0).toLocaleString()} XAF`);
  }
  if (listing?.seller?.university) {
    parts.push(`near ${listing.seller.university}`);
  } else if (listing?.location) {
    parts.push(`located around ${listing.location}`);
  }
  if (listing?.seller?.rating) {
    parts.push(`seller rating ${toSafeNumber(listing.seller.rating, 0).toFixed(1)}`);
  }
  if (!parts.length) {
    return "Matches your request and is currently available.";
  }
  return `Matches your request and is ${parts.join(", ")}.`;
};

type AiProviderName = "openai" | "gemini" | "huggingface" | "auto";

type AiChatRequestArgs = {
  systemPrompt: string;
  listingsContext: any[];
  history: any[];
  userMessage: string;
  imageDataUrls: string[];
  location: any;
};

const normalizeAiProvider = (value: unknown): AiProviderName => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "gemini") return "gemini";
  if (normalized === "huggingface" || normalized === "hugging_face" || normalized === "hf") return "huggingface";
  if (normalized === "auto") return "auto";
  return "openai";
};

const getModelNameForProvider = (provider: Exclude<AiProviderName, "auto">) => {
  if (provider === "gemini") {
    return GEMINI_CHAT_MODEL;
  }
  if (provider === "huggingface") {
    return HUGGING_FACE_MODEL;
  }
  return OPENAI_CHAT_MODEL;
};

const getPreferredAiProviderOrder = (): Array<Exclude<AiProviderName, "auto">> => {
  const configured = normalizeAiProvider(AI_PROVIDER);
  if (configured !== "auto") {
    return [configured];
  }

  const order: Array<Exclude<AiProviderName, "auto">> = [];
  if (HUGGING_FACE_API_KEY) {
    order.push("huggingface");
  }
  if (GEMINI_API_KEY) {
    order.push("gemini");
  }
  if (OPENAI_API_KEY) {
    order.push("openai");
  }

  if (!order.length) {
    return ["openai", "gemini", "huggingface"];
  }

  return order;
};

const buildTextOnlyChatPrompt = (args: AiChatRequestArgs) =>
  [
    args.systemPrompt,
    `Available listings JSON: ${JSON.stringify(args.listingsContext)}`,
    `Conversation history: ${JSON.stringify(args.history.slice(-10))}`,
    `User location context: ${JSON.stringify(args.location || {})}`,
    `User message: ${args.userMessage}`,
    args.imageDataUrls.length
      ? `Attached images: ${args.imageDataUrls.length} image(s). If image details are unavailable, ask a follow-up question.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

const parseDataUrlImage = (value: string) => {
  const match = String(value || "").match(/^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1],
    data: match[2].replace(/\s+/g, ""),
  };
};

async function requestOpenAiChatResponse(args: AiChatRequestArgs) {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      provider: "openai",
      model: OPENAI_CHAT_MODEL,
      message: "Missing OPENAI_API_KEY",
    };
  }

  const messages: any[] = [
    {
      role: "system",
      content: args.systemPrompt,
    },
    {
      role: "system",
      content: `Available listings JSON: ${JSON.stringify(args.listingsContext)}`,
    },
    ...args.history.slice(-10).map((entry: any) => ({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: normalizeAiText(entry.content, 3000),
    })),
  ];

  const userContent: any[] = [
    {
      type: "text",
      text: [
        `User location context: ${JSON.stringify(args.location || {})}`,
        `User message: ${args.userMessage}`,
      ].join("\n"),
    },
  ];

  for (const imageUrl of args.imageDataUrls) {
    userContent.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  messages.push({
    role: "user",
    content: userContent,
  });

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://campus-market-yz1h.onrender.com",
      "X-Title": "Campus Market Sasha AI",
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.35,
      messages,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      provider: "openai",
      model: OPENAI_CHAT_MODEL,
      message: payload?.error?.message || "OpenAI request failed",
    };
  }

  const content = normalizeAiText(payload?.choices?.[0]?.message?.content, 120_000);
  if (!content) {
    return {
      ok: false,
      provider: "openai",
      model: OPENAI_CHAT_MODEL,
      message: "Empty response from OpenAI",
    };
  }

  return {
    ok: true,
    provider: "openai",
    model: OPENAI_CHAT_MODEL,
    content,
  };
}

async function requestGeminiChatResponse(args: AiChatRequestArgs) {
  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      provider: "gemini",
      model: GEMINI_CHAT_MODEL,
      message: "Missing GEMINI_API_KEY",
    };
  }

  const historyMessages = args.history.slice(-10).map((entry: any) => ({
    role: entry?.role === "assistant" ? "model" : "user",
    parts: [{ text: normalizeAiText(entry?.content, 3000) }],
  }));

  const userParts: any[] = [
    {
      text: [
        `User location context: ${JSON.stringify(args.location || {})}`,
        `User message: ${args.userMessage}`,
      ].join("\n"),
    },
  ];

  for (const imageUrl of args.imageDataUrls) {
    const parsed = parseDataUrlImage(imageUrl);
    if (!parsed) {
      continue;
    }
    userParts.push({
      inline_data: {
        mime_type: parsed.mimeType,
        data: parsed.data,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_CHAT_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: args.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `Available listings JSON: ${JSON.stringify(args.listingsContext)}` }],
          },
          ...historyMessages,
          {
            role: "user",
            parts: userParts,
          },
        ],
        generationConfig: {
          temperature: 0.35,
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      provider: "gemini",
      model: GEMINI_CHAT_MODEL,
      message: payload?.error?.message || "Gemini request failed",
    };
  }

  const textContent = Array.isArray(payload?.candidates?.[0]?.content?.parts)
    ? payload.candidates[0].content.parts
      .map((part: any) => normalizeAiText(part?.text, 60000))
      .filter(Boolean)
      .join("\n")
    : "";

  const content = normalizeAiText(textContent, 120_000);
  if (!content) {
    return {
      ok: false,
      provider: "gemini",
      model: GEMINI_CHAT_MODEL,
      message: "Empty response from Gemini",
    };
  }

  return {
    ok: true,
    provider: "gemini",
    model: GEMINI_CHAT_MODEL,
    content,
  };
}

async function requestHuggingFaceChatResponse(args: AiChatRequestArgs) {
  if (!HUGGING_FACE_API_KEY) {
    return {
      ok: false,
      provider: "huggingface",
      model: HUGGING_FACE_MODEL,
      message: "Missing HUGGING_FACE_API_KEY/HF_TOKEN",
    };
  }

  const messages: any[] = [
    {
      role: "system",
      content: args.systemPrompt,
    },
    {
      role: "system",
      content: `Available listings JSON: ${JSON.stringify(args.listingsContext)}`,
    },
    ...args.history.slice(-10).map((entry: any) => ({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: normalizeAiText(entry.content, 3000),
    })),
    {
      role: "user",
      content: [
        `User location context: ${JSON.stringify(args.location || {})}`,
        `User message: ${args.userMessage}`,
        args.imageDataUrls.length
          ? `Attached images: ${args.imageDataUrls.length} image(s). If image detail is missing, ask a short follow-up question.`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  const requestInferenceApiFallback = async (routerErrorMessage: string) => {
    const inferencePrompt = buildTextOnlyChatPrompt(args);
    const inferenceResponse = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(HUGGING_FACE_MODEL)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: inferencePrompt,
          parameters: {
            temperature: 0.35,
            max_new_tokens: 900,
            do_sample: true,
            return_full_text: false,
          },
          options: {
            wait_for_model: true,
          },
        }),
      },
    );

    const inferencePayload = await inferenceResponse.json().catch(() => ({}));
    if (!inferenceResponse.ok) {
      return {
        ok: false,
        provider: "huggingface",
        model: HUGGING_FACE_MODEL,
        message:
          `Hugging Face router failed (${routerErrorMessage}). ` +
          (
            inferencePayload?.error?.message ||
            inferencePayload?.error ||
            `Inference API request failed (${inferenceResponse.status})`
          ),
      };
    }

    let generatedText = "";
    if (Array.isArray(inferencePayload)) {
      generatedText = normalizeAiText(inferencePayload?.[0]?.generated_text, 120_000);
    } else {
      generatedText = normalizeAiText(inferencePayload?.generated_text, 120_000);
    }

    if (!generatedText) {
      return {
        ok: false,
        provider: "huggingface",
        model: HUGGING_FACE_MODEL,
        message: "Empty response from Hugging Face Inference API",
      };
    }

    return {
      ok: true,
      provider: "huggingface",
      model: HUGGING_FACE_MODEL,
      content: generatedText,
    };
  };

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: HUGGING_FACE_MODEL,
      messages,
      temperature: 0.35,
      max_tokens: 900,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = String(payload?.error?.message || payload?.error || "").trim();
    const errorCode = String(payload?.error?.code || "").trim().toLowerCase();
    const modelNotSupported =
      errorCode === "model_not_supported" ||
      errorMessage.toLowerCase().includes("not supported by any provider");

    if (modelNotSupported) {
      return await requestInferenceApiFallback(errorMessage || `router status ${response.status}`);
    }

    return {
      ok: false,
      provider: "huggingface",
      model: HUGGING_FACE_MODEL,
      message: errorMessage || `Hugging Face request failed (${response.status})`,
    };
  }

  let generatedText = normalizeAiText(payload?.choices?.[0]?.message?.content, 120_000);

  if (!generatedText && Array.isArray(payload?.choices?.[0]?.message?.content)) {
    generatedText = normalizeAiText(
      payload.choices[0].message.content
        .map((part: any) => normalizeAiText(part?.text, 60000))
        .filter(Boolean)
        .join("\n"),
      120_000,
    );
  }

  if (!generatedText) {
    return {
      ok: false,
      provider: "huggingface",
      model: HUGGING_FACE_MODEL,
      message: "Empty response from Hugging Face",
    };
  }

  return {
    ok: true,
    provider: "huggingface",
    model: HUGGING_FACE_MODEL,
    content: generatedText,
  };
}

async function requestAiChatResponse(args: AiChatRequestArgs) {
  const providers = getPreferredAiProviderOrder();
  const failures: string[] = [];

  for (const provider of providers) {
    const result =
      provider === "gemini"
        ? await requestGeminiChatResponse(args)
        : provider === "huggingface"
          ? await requestHuggingFaceChatResponse(args)
          : await requestOpenAiChatResponse(args);

    if (result?.ok) {
      return result;
    }

    const reason = normalizeAiText(result?.message || "request failed", 300);
    failures.push(`${provider}: ${reason || "request failed"}`);
  }

  return {
    ok: false,
    provider: "fallback",
    model: getModelNameForProvider(getPreferredAiProviderOrder()[0] || "openai"),
    message:
      failures.join(" | ") ||
      "No AI provider is configured. Set AI_PROVIDER and corresponding API key env vars.",
  };
}

async function requestOpenAiTranscription(file: File) {
  if (!OPENAI_API_KEY) {
    return { ok: false, error: "Missing OPENAI_API_KEY" };
  }

  const formData = new FormData();
  formData.append("file", file, sanitizeFileName(file.name || "voice.webm"));
  formData.append("model", OPENAI_TRANSCRIBE_MODEL);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: payload?.error?.message || "Transcription failed",
    };
  }

  return {
    ok: true,
    text: normalizeAiText(payload?.text, 4000),
  };
}

async function requestHuggingFaceTranscription(file: File) {
  if (!HUGGING_FACE_API_KEY) {
    return { ok: false, error: "Missing HUGGING_FACE_API_KEY" };
  }

  const arrayBuffer = await file.arrayBuffer();
  const response = await fetch(
    "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
        "Content-Type": "application/octet-stream",
      },
      body: arrayBuffer,
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: typeof payload?.error === "string" ? payload.error : "HuggingFace transcription failed",
    };
  }

  return {
    ok: true,
    text: normalizeAiText(payload?.text, 4000),
  };
}

// Health check endpoint
app.get("/make-server-50b25a4f/health", (c) => {
  return c.json({
    status: "ok",
    database: "postgres",
    auth: AUTH_PROVIDER,
    storage: STORAGE_PROVIDER,
    email: isEmailDeliveryConfigured ? "smtp" : "disabled",
  });
});

// Fapshi webhook callback.
// Fapshi POSTs the payment-status object on every status change. There is NO
// HMAC signature, so we NEVER trust the POST body: we extract only the transId
// and re-fetch the authoritative status from Fapshi before acting. Processing
// is idempotent per transId so retries/duplicates are safe.
const handleFapshiWebhookGet = (c: any) => c.json({ status: "ok" });
const handleFapshiWebhookPost = async (c: any) => {
  let rawBody = "";
  let payload: any = null;
  try {
    rawBody = await c.req.text();
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = null;
      }
    }

    // Store the raw event for audit (capped ring buffer).
    const eventId = createEntityId("FPWH");
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    await kv.set(`fapshi:webhook:${eventId}`, {
      id: eventId,
      receivedAt: new Date().toISOString(),
      headers,
      payload,
      rawBody,
    });
    const recent = (await kv.get("fapshi:webhook:ids")) || [];
    recent.push(eventId);
    if (recent.length > 200) {
      recent.splice(0, recent.length - 200);
    }
    await kv.set("fapshi:webhook:ids", recent);

    const transId = String(payload?.transId || payload?.transID || "").trim();
    await recordPaymentAudit("webhook_received", { transId, eventId });
    if (!transId) {
      return c.json({ received: true });
    }

    // Idempotency: skip if we already applied a terminal outcome for this txn.
    const processed = await kv.get(`fapshi:webhook:processed:${transId}`);
    if (processed && ["successful", "failed", "expired"].includes(processed.status)) {
      return c.json({ received: true, duplicate: true });
    }

    // Resolve what this transId belongs to (order vs payout).
    const mapping = await kv.get(`fapshi:tx:${transId}`);
    const service = mapping?.type === "payout" ? "payout" : "collection";

    // Source of truth: re-fetch the status from Fapshi.
    let statusData: any = null;
    try {
      statusData = await getFapshiPaymentStatus(transId, service);
    } catch (verifyError) {
      console.error("Fapshi webhook verification failed:", verifyError);
      await recordPaymentAudit("webhook_verify_failed", {
        transId,
        error: verifyError instanceof Error ? verifyError.message : String(verifyError),
      });
      // Acknowledge so Fapshi doesn't retry-storm; we can reconcile later.
      return c.json({ received: true, verified: false });
    }

    const status = normalizeFapshiStatus(statusData?.status);
    await recordPaymentAudit("webhook_verified", { transId, status, type: mapping?.type || "unknown" });

    if (mapping?.type === "payout") {
      await reconcileFapshiPayout(mapping.withdrawalId, status, statusData);
    } else if (mapping?.type === "subscription") {
      if (status === "successful") {
        await activateSubscriptionFromPayment(mapping.paymentId);
      } else if (status === "failed" || status === "expired") {
        await failSubscriptionPayment(mapping.paymentId, `Fapshi payment ${status}`);
      }
    } else if (mapping?.type === "order" || mapping?.orderId) {
      if (status === "successful") {
        await confirmEscrowOrderPaid(mapping.orderId);
      } else if (status === "failed" || status === "expired") {
        await voidAwaitingEscrowOrder(mapping.orderId, `Fapshi payment ${status}`, status);
      }
    }

    if (["successful", "failed", "expired"].includes(status)) {
      await kv.set(`fapshi:webhook:processed:${transId}`, {
        status,
        type: mapping?.type || "unknown",
        at: new Date().toISOString(),
      });
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("Fapshi webhook error:", error);
    // Still 200 so the provider does not hammer retries; failure is audited.
    await recordPaymentAudit("webhook_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ received: false }, 200);
  }
};
// Fapshi callback routes (configure …/fapshi/webhook in the Fapshi dashboard).
app.get("/make-server-50b25a4f/fapshi/webhook", handleFapshiWebhookGet);
app.get("/fapshi/webhook", handleFapshiWebhookGet);
app.post("/make-server-50b25a4f/fapshi/webhook", handleFapshiWebhookPost);
app.post("/fapshi/webhook", handleFapshiWebhookPost);
// Backward-compatible aliases for any previously configured /campay/webhook URL.
app.get("/make-server-50b25a4f/campay/webhook", handleFapshiWebhookGet);
app.get("/campay/webhook", handleFapshiWebhookGet);
app.post("/make-server-50b25a4f/campay/webhook", handleFapshiWebhookPost);
app.post("/campay/webhook", handleFapshiWebhookPost);

// ============ AUTHENTICATION ROUTES ============

// Sign up endpoint
app.post("/make-server-50b25a4f/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password, phone, university, studentId, userType, profilePicture } = body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedUserType = userType === 'seller' ? 'seller' : 'buyer';
    const normalizedProfilePicture = typeof profilePicture === 'string' ? profilePicture : '';
    const adminSettings = {
      ...DEFAULT_ADMIN_SETTINGS,
      ...(await kv.get("admin:settings") || {}),
    };

    if (adminSettings.maintenanceMode) {
      return c.json({ error: 'Platform is in maintenance mode. Please try again later.' }, 503);
    }

    if (!adminSettings.allowNewRegistrations) {
      return c.json({ error: 'New registrations are currently disabled.' }, 403);
    }

    if (!name || !normalizedEmail || !password || !phone || !university) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const existingAuthRecord = await getLocalAuthRecordByEmail(normalizedEmail);
    const existingProfile = await findUserProfileByEmail(normalizedEmail);
    if (existingAuthRecord || existingProfile) {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const authRecord = {
      userId,
      email: normalizedEmail,
      // Auto-verify unless email confirmation is explicitly required.
      emailVerified: !requireEmailConfirmation,
      emailConfirmedAt: requireEmailConfirmation ? "" : now,
      twoFactorEnabled: requireTwoFactorByDefault,
      ...(await createPasswordRecord(password)),
      createdAt: now,
    };

    const userProfile = {
      id: userId,
      name,
      email: normalizedEmail,
      phone,
      university,
      studentId: studentId || '',
      rating: 0,
      reviewCount: 0,
      isVerified: false,
      isApproved: true,
      role: 'student',
      userType: normalizedUserType,
      profilePicture: normalizedProfilePicture,
      avatar: normalizedProfilePicture,
      isBanned: false,
      createdAt: now,
    };

    await persistLocalAuthRecord(authRecord);
    await kv.mset(
      [`user:${userId}`, `wallet:${userId}`],
      [
        userProfile,
        {
          userId,
          availableBalance: 0,
          pendingBalance: 0,
          updatedAt: now,
        },
      ],
    );

    if (requireEmailConfirmation) {
      // Preferred path: 6-digit verification code entered in-app.
      if (EMAIL_VERIFICATION_METHOD === "code") {
        const delivery = await sendEmailVerificationChallenge(userId, normalizedEmail);
        const responseMessage =
          delivery.deliveryMethod === "email"
            ? "Account created. We sent a 6-digit verification code to your email — enter it to activate your account."
            : "Account created. Email delivery is not configured here, so use the verification code below.";

        return c.json({
          success: true,
          message: responseMessage,
          userId,
          email: normalizedEmail,
          requiresEmailConfirmation: true,
          verificationMethod: "code",
          // Surface the code only when it could not be emailed (dev/preview).
          ...(delivery.deliveryMethod === "fallback" ? { verificationCode: delivery.code } : {}),
        });
      }

      // Legacy path: clickable confirmation link.
      const confirmationToken = await createEmailConfirmationSession(userId, normalizedEmail);
      const confirmationLink = await createEmailConfirmationLink(c.req.raw, confirmationToken);
      let responseMessage = 'Account created successfully. Check your email to confirm your account before logging in.';
      let fallbackConfirmationLink = '';

      if (isEmailDeliveryConfigured) {
        try {
          await sendAccountConfirmationEmail(normalizedEmail, confirmationLink);
        } catch (error) {
          console.error('Confirmation email error:', error);
          responseMessage = 'Account created. We could not send your confirmation email right now, so use the link below to confirm.';
          fallbackConfirmationLink = confirmationLink;
        }
      } else {
        responseMessage = 'Account created. Email delivery is not configured here, so use the confirmation link below.';
        fallbackConfirmationLink = confirmationLink;
      }

      return c.json({
        success: true,
        message: responseMessage,
        userId,
        requiresEmailConfirmation: true,
        verificationMethod: "link",
        ...(fallbackConfirmationLink ? { confirmationLink: fallbackConfirmationLink } : {}),
      });
    }

    return c.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      userId,
      requiresEmailConfirmation: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred during signup';
    console.error('Signup error:', message);
    return c.json({ error: message }, 500);
  }
});

// Send password reset email
app.post("/make-server-50b25a4f/auth/forgot-password", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const authRecord = await getLocalAuthRecordByEmail(email);
    const profile = authRecord?.userId ? null : await findUserProfileByEmail(email);
    const targetUserId = authRecord?.userId || profile?.id || "";
    const targetEmail = authRecord?.email || profile?.email || email;

    if (!targetUserId) {
      return c.json({
        success: true,
        message: 'If an account exists for that email, a reset link will appear here.',
        accountFound: false,
      });
    }

    const resetToken = await createPasswordResetSession(targetUserId, targetEmail);
    const resetLink = await createPasswordResetLink(c.req.raw, resetToken);

    if (isEmailDeliveryConfigured) {
      try {
        await sendPasswordResetEmail(targetEmail, resetLink);
        return c.json({
          success: true,
          message: 'Password reset email sent. Check your inbox.',
          accountFound: true,
        });
      } catch (error) {
        console.error('Password reset email error:', error);
      }
    }

    return c.json({
      success: true,
      message: 'Reset link generated successfully. Email delivery is not configured here, so use the link below.',
      resetLink,
      accountFound: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send reset email';
    console.error('Forgot password error:', message);
    return c.json({ error: message }, 500);
  }
});

// Reset password using recovery token
app.post("/make-server-50b25a4f/auth/reset-password", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';
    const authHeader = c.req.header("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
    const resetToken = typeof body?.token === "string" && body.token ? body.token : bearerToken;

    if (!password || password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    if (!resetToken) {
      return c.json({ error: 'Invalid or expired reset link.' }, 401);
    }

    const resetTokenHash = await sha256Hex(resetToken);
    const resetSession = await kv.get(authPasswordResetKey(resetTokenHash));
    if (!resetSession?.userId) {
      return c.json({ error: 'Invalid or expired reset link.' }, 401);
    }

    const expiresAt = typeof resetSession.expiresAt === "string" ? Date.parse(resetSession.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await kv.del(authPasswordResetKey(resetTokenHash));
      return c.json({ error: 'Invalid or expired reset link.' }, 401);
    }

    let authRecord = await getLocalAuthRecordByUserId(resetSession.userId);
    if (!authRecord) {
      const profile = await getUserProfile(resetSession.userId);
      if (!profile?.email) {
        await kv.del(authPasswordResetKey(resetTokenHash));
        return c.json({ error: 'User account is not available for password reset.' }, 404);
      }

      authRecord = {
        userId: resetSession.userId,
        email: normalizeEmail(profile.email),
        emailVerified: true,
        emailConfirmedAt: new Date().toISOString(),
        twoFactorEnabled: requireTwoFactorByDefault,
        createdAt: new Date().toISOString(),
      };
    }

    Object.assign(authRecord, await createPasswordRecord(password));
    await persistLocalAuthRecord(authRecord);
    await kv.del(authPasswordResetKey(resetTokenHash));

    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset password';
    console.error('Reset password error:', message);
    return c.json({ error: message }, 500);
  }
});

app.post("/make-server-50b25a4f/auth/confirm-email", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return c.json({ error: "Confirmation token is required" }, 400);
    }

    const tokenHash = await sha256Hex(token);
    const confirmationSession = await kv.get(authEmailConfirmationKey(tokenHash));
    if (!confirmationSession?.userId) {
      return c.json({ error: "Invalid or expired confirmation link." }, 401);
    }

    const expiresAt = typeof confirmationSession.expiresAt === "string"
      ? Date.parse(confirmationSession.expiresAt)
      : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await kv.del(authEmailConfirmationKey(tokenHash));
      return c.json({ error: "Invalid or expired confirmation link." }, 401);
    }

    const authRecord = await getLocalAuthRecordByUserId(confirmationSession.userId);
    if (!authRecord) {
      await kv.del(authEmailConfirmationKey(tokenHash));
      return c.json({ error: "Account not found for this confirmation link." }, 404);
    }

    authRecord.emailVerified = true;
    authRecord.emailConfirmedAt = new Date().toISOString();
    await persistLocalAuthRecord(authRecord);
    await kv.del(authEmailConfirmationKey(tokenHash));

    return c.json({ success: true, message: "Email confirmed successfully. You can now log in." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm email";
    console.error("Email confirmation error:", message);
    if (/MaxClientsInSessionMode|too many clients|remaining connection slots/i.test(message)) {
      return c.json(
        { error: "Service is temporarily busy. Please try confirming your email again in a few seconds." },
        503,
      );
    }
    return c.json({ error: message }, 500);
  }
});

// Verify a 6-digit signup email-verification code.
app.post("/make-server-50b25a4f/auth/verify-email-code", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!email || !code) {
      return c.json({ error: "Email and verification code are required." }, 400);
    }
    if (!TWO_FACTOR_CODE_PATTERN.test(code)) {
      return c.json({ error: "Verification code must be 6 digits." }, 400);
    }

    const authRecord = await getLocalAuthRecordByEmail(email);
    if (!authRecord?.userId) {
      return c.json({ error: "Invalid or expired verification code." }, 401);
    }

    if (authRecord.emailVerified !== false) {
      return c.json({ success: true, message: "Email already verified. You can sign in." });
    }

    const session = await kv.get(authEmailVerifyCodeKey(authRecord.userId));
    if (!session?.codeHash) {
      return c.json({ error: "Invalid or expired verification code. Request a new one." }, 401);
    }

    const expiresAt = typeof session.expiresAt === "string" ? Date.parse(session.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await kv.del(authEmailVerifyCodeKey(authRecord.userId));
      return c.json({ error: "Verification code expired. Request a new one." }, 401);
    }

    const attempts = toFiniteNumber(session.attempts, 0);
    if (attempts >= TWO_FACTOR_MAX_ATTEMPTS) {
      await kv.del(authEmailVerifyCodeKey(authRecord.userId));
      return c.json({ error: "Too many failed attempts. Request a new code." }, 401);
    }

    const submittedHash = await sha256Hex(code);
    if (!timingSafeEqual(submittedHash, String(session.codeHash))) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= TWO_FACTOR_MAX_ATTEMPTS) {
        await kv.del(authEmailVerifyCodeKey(authRecord.userId));
        return c.json({ error: "Too many failed attempts. Request a new code." }, 401);
      }
      await kv.set(authEmailVerifyCodeKey(authRecord.userId), { ...session, attempts: nextAttempts });
      const remaining = TWO_FACTOR_MAX_ATTEMPTS - nextAttempts;
      return c.json({
        error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      }, 400);
    }

    authRecord.emailVerified = true;
    authRecord.emailConfirmedAt = new Date().toISOString();
    await persistLocalAuthRecord(authRecord);
    await kv.del(authEmailVerifyCodeKey(authRecord.userId));

    return c.json({ success: true, message: "Email verified successfully. You can now sign in." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify email code";
    console.error("Verify email code error:", message);
    return c.json({ error: message }, 500);
  }
});

app.post("/make-server-50b25a4f/auth/resend-confirmation", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    const authRecord = await getLocalAuthRecordByEmail(email);
    if (!authRecord?.userId) {
      return c.json({
        success: true,
        message: "If an account exists for that email, a new verification message has been sent.",
      });
    }

    if (authRecord.emailVerified !== false) {
      return c.json({
        success: true,
        message: "This email is already confirmed. You can log in now.",
      });
    }

    // Code-based verification: re-issue and deliver a fresh 6-digit code.
    if (EMAIL_VERIFICATION_METHOD === "code") {
      const delivery = await sendEmailVerificationChallenge(authRecord.userId, authRecord.email);
      return c.json({
        success: true,
        verificationMethod: "code",
        message:
          delivery.deliveryMethod === "email"
            ? "A new 6-digit verification code has been sent to your email."
            : "Email delivery is not configured here. Use the verification code below.",
        ...(delivery.deliveryMethod === "fallback" ? { verificationCode: delivery.code } : {}),
      });
    }

    const confirmationToken = await createEmailConfirmationSession(authRecord.userId, authRecord.email);
    const confirmationLink = await createEmailConfirmationLink(c.req.raw, confirmationToken);

    if (isEmailDeliveryConfigured) {
      try {
        await sendAccountConfirmationEmail(authRecord.email, confirmationLink);
        return c.json({
          success: true,
          message: "Confirmation email sent. Please check your inbox.",
        });
      } catch (error) {
        console.error("Resend confirmation email error:", error);
        return c.json({
          success: true,
          message: "We could not deliver the confirmation email right now. Use the confirmation link below.",
          confirmationLink,
        });
      }
    }

    return c.json({
      success: true,
      message: "Email delivery is not configured here. Use the confirmation link below.",
      confirmationLink,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resend confirmation email";
    console.error("Resend confirmation error:", message);
    return c.json({ error: message }, 500);
  }
});

// Sign in endpoint
app.post("/make-server-50b25a4f/signin", async (c) => {
  try {
    const body = await c.req.json();
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const authRecord = await getLocalAuthRecordByEmail(email);
    const validPassword = authRecord ? await verifyPassword(password, authRecord) : false;
    if (!authRecord) {
      const existingProfile = await findUserProfileByEmail(email);
      if (existingProfile?.id) {
        return c.json({
          error: 'This account needs a password reset before first login. Use Forgot password to generate a setup link.',
        }, 409);
      }
      return c.json({ error: 'Invalid email or password' }, 400);
    }

    if (!validPassword) {
      return c.json({ error: 'Invalid email or password' }, 400);
    }

    if (requireEmailConfirmation && authRecord.emailVerified === false) {
      return c.json({ error: 'Please confirm your email before logging in.' }, 403);
    }

    const profile = await getUserProfile(authRecord.userId);
    
    if (!profile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    if (profile.isBanned) {
      return c.json({ error: 'Your account has been suspended. Contact support.' }, 403);
    }

    // Challenge decision. Admins sign in directly. For everyone else:
    //   • If the user has enabled 2FA, always require their 2FA challenge.
    //   • Otherwise, normal login is just email + password (NO code).
    // The optional new-device email challenge is OFF by default and only kicks
    // in when AUTH_CHALLENGE_NEW_DEVICE=true is set.
    const deviceHash = await computeDeviceHash(c.req.raw);
    const rememberDevice = body?.rememberDevice === true;
    const twoFactorOn = isTwoFactorEnabled(authRecord);
    const trustedDevice = await isTrustedDevice(profile.id, deviceHash);
    const newDeviceChallenge = challengeNewDevices && !trustedDevice;

    if (profile.role !== "admin" && (twoFactorOn || newDeviceChallenge)) {
      try {
        // Use the authenticator when enrolled; otherwise fall back to an email code.
        const challengeType = hasTotpEnrolled(authRecord) ? "totp" : "email";
        const challenge = await createTwoFactorSession(profile.id, profile.email, {
          challengeType,
          deviceHash,
          rememberDevice,
          purpose: twoFactorOn ? "login" : "new-device",
        });

        const newDeviceOnly = !twoFactorOn && newDeviceChallenge;
        return c.json({
          success: false,
          requiresTwoFactor: true,
          twoFactorToken: challenge.token,
          challengeType,
          newDevice: newDeviceOnly,
          message:
            challengeType === "totp"
              ? "Enter the code from your authenticator app to continue."
              : newDeviceOnly
                ? "We noticed a sign-in from a new device. Enter the 6-digit code we emailed you to continue."
                : challenge.deliveryMethod === "email"
                  ? "We sent a 6-digit verification code to your email."
                  : "Enter the verification code to continue.",
          ...((twoFactorDevReveal || challenge.deliveryMethod === "fallback") && challenge.code
            ? { verificationCode: challenge.code }
            : {}),
        });
      } catch (error) {
        console.error("Failed to start sign-in challenge:", error);
        return c.json({ error: "Could not send your verification code. Please try again." }, 500);
      }
    }

    // Trusted device + 2FA off: refresh the trust window and issue a session.
    if (deviceHash) {
      await rememberTrustedDevice(profile.id, deviceHash, c.req.header("user-agent"));
    }

    const { accessToken, refreshToken } = await createSessionPair(profile.id, profile.email);

    return c.json({
      success: true,
      accessToken,
      refreshToken,
      user: profile,
    });
  } catch (error) {
    console.error("Signin error:", error);
    return c.json({ error: "An error occurred during signin" }, 500);
  }
});

app.post("/make-server-50b25a4f/auth/verify-2fa", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!token || !code) {
      return c.json({ error: "Verification token and code are required." }, 400);
    }

    const tokenHash = await sha256Hex(token);
    const session = await kv.get(authTwoFactorSessionKey(tokenHash));
    if (!session?.userId) {
      return c.json({ error: "Invalid or expired verification session." }, 401);
    }

    const expiresAt = typeof session.expiresAt === "string" ? Date.parse(session.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await clearTwoFactorSession(tokenHash, session.userId);
      return c.json({ error: "Verification session expired. Please sign in again." }, 401);
    }

    const attempts = toFiniteNumber(session.attempts, 0);
    if (attempts >= TWO_FACTOR_MAX_ATTEMPTS) {
      await clearTwoFactorSession(tokenHash, session.userId);
      return c.json({ error: "Too many failed attempts. Please sign in again." }, 401);
    }

    // TOTP challenges accept an authenticator code or a single-use backup code;
    // email challenges compare against the emailed 6-digit code.
    let verified = false;
    if (session.challengeType === "totp") {
      const authRecord = await getLocalAuthRecordByUserId(session.userId);
      if (!authRecord) {
        await clearTwoFactorSession(tokenHash, session.userId);
        return c.json({ error: "Unauthorized" }, 401);
      }
      verified = await verifyTwoFactorCredential(authRecord, code);
    } else {
      if (!TWO_FACTOR_CODE_PATTERN.test(code)) {
        return c.json({ error: "Verification code must be 6 digits." }, 400);
      }
      const submittedCodeHash = await sha256Hex(code);
      verified = timingSafeEqual(submittedCodeHash, String(session.codeHash || ""));
    }

    if (!verified) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= TWO_FACTOR_MAX_ATTEMPTS) {
        await clearTwoFactorSession(tokenHash, session.userId);
        return c.json({ error: "Too many failed attempts. Please sign in again." }, 401);
      }

      await kv.set(authTwoFactorSessionKey(tokenHash), {
        ...session,
        attempts: nextAttempts,
      });
      const remainingAttempts = TWO_FACTOR_MAX_ATTEMPTS - nextAttempts;
      return c.json({
        error: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
      }, 400);
    }

    const profile = await getUserProfile(session.userId);
    if (!profile || profile.isBanned) {
      await clearTwoFactorSession(tokenHash, session.userId);
      return c.json({ error: "Unauthorized" }, 401);
    }

    await clearTwoFactorSession(tokenHash, session.userId);

    // Honor "remember this device" so future logins from it skip the challenge.
    if (session.rememberDevice && session.deviceHash) {
      await rememberTrustedDevice(session.userId, session.deviceHash, c.req.header("user-agent"));
    }

    const { accessToken, refreshToken } = await createSessionPair(profile.id, profile.email || session.email);

    return c.json({
      success: true,
      accessToken,
      refreshToken,
      user: profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify code";
    console.error("Two-factor verification error:", message);
    return c.json({ error: message }, 500);
  }
});

app.post("/make-server-50b25a4f/auth/resend-2fa", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return c.json({ error: "Verification token is required." }, 400);
    }

    const result = await resendTwoFactorSessionCode(token);
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }

    return c.json({
      success: true,
      message:
        result.deliveryMethod === "email"
          ? "A new 6-digit verification code has been sent to your email."
          : "A new verification code was generated for this environment.",
      ...((twoFactorDevReveal || result.deliveryMethod === "fallback") && result.code
        ? { verificationCode: result.code }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resend verification code";
    console.error("Two-factor resend error:", message);
    return c.json({ error: message }, 500);
  }
});

// Refresh access token using a refresh token
app.post("/make-server-50b25a4f/auth/refresh", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const refreshToken = normalizeAuthTokenInput(
      typeof body?.refreshToken === "string"
        ? body.refreshToken
        : c.req.header("x-refresh-token"),
    );

    if (!refreshToken) {
      return c.json({ error: "Refresh token is required" }, 400);
    }

    const refreshSession = await getValidSession(refreshToken, "refresh");
    if (!refreshSession) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const profile = await getUserProfile(refreshSession.userId);
    if (!profile || profile.isBanned) {
      await kv.del(authRefreshKey(refreshToken));
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Keep refresh token reusable (non-rotating) to avoid cross-tab/device race logout loops.
    // We still rotate access tokens on each refresh.
    const nextSession = await createSessionPair(refreshSession.userId, refreshSession.email || profile.email);
    const now = Date.now();
    const nextRefreshSession = {
      ...refreshSession,
      type: "refresh",
      userId: refreshSession.userId,
      email: refreshSession.email || profile.email,
      // Extend refresh expiry from "now" while preserving configured TTL.
      expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
      lastUsedAt: new Date(now).toISOString(),
    };
    await kv.set(authRefreshKey(refreshToken), nextRefreshSession);
    await kv.del(authRefreshKey(nextSession.refreshToken));

    return c.json({
      accessToken: nextSession.accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return c.json({ error: "Failed to refresh token" }, 500);
  }
});

// Get current user profile
app.get("/make-server-50b25a4f/auth/me", async (c) => {
  const user =
    (await verifyAuth(c.req.header('Authorization'))) ||
    (await verifyRefreshTokenUser(c.req.header("x-refresh-token")));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getUserProfile(user.id);
  
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  return c.json({ user: profile });
});

// Update user profile
app.put("/make-server-50b25a4f/auth/profile", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { name, phone, studentId, profilePicture, notificationPreferences, privacyOptions } = body;

    const profile = await getUserProfile(user.id);
    
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    // Update profile
    if (typeof name === 'string' && name.trim().length > 0) {
      profile.name = name.trim();
    }
    if (typeof phone === 'string' && phone.trim().length > 0) {
      profile.phone = phone.trim();
    }
    if (typeof studentId === 'string') {
      profile.studentId = studentId;
    }
    if (typeof profilePicture === 'string') {
      profile.profilePicture = profilePicture;
      profile.avatar = profilePicture;
    }
    if (notificationPreferences && typeof notificationPreferences === "object") {
      profile.notificationPreferences = {
        messages: Boolean(notificationPreferences.messages),
        orders: Boolean(notificationPreferences.orders),
        payments: Boolean(notificationPreferences.payments),
        rentals: Boolean(notificationPreferences.rentals),
      };
    }
    if (privacyOptions && typeof privacyOptions === "object") {
      profile.privacyOptions = {
        showPhone: Boolean(privacyOptions.showPhone),
        showEmail: Boolean(privacyOptions.showEmail),
        profileVisibility: privacyOptions.profileVisibility === "private" ? "private" : "public",
      };
    }

    await kv.set(`user:${user.id}`, profile);

    return c.json({ success: true, user: profile });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Change password for current user
app.post("/make-server-50b25a4f/auth/change-password", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: "New password must be at least 6 characters" }, 400);
    }

    const authRecord = await getLocalAuthRecordByUserId(user.id);
    if (!authRecord) {
      return c.json({ error: "Password login is not configured for this account" }, 404);
    }

    const currentPasswordMatches = await verifyPassword(currentPassword, authRecord);
    if (!currentPasswordMatches) {
      return c.json({ error: "Current password is incorrect" }, 400);
    }

    // Sensitive action: require a step-up challenge (authenticator code for TOTP
    // users, otherwise an emailed confirmation code).
    const challengeCode = typeof body?.challengeCode === "string" ? body.challengeCode : "";
    const stepUp = await evaluateStepUp(authRecord, challengeCode);
    if (!stepUp.ok) {
      return c.json({ success: false, ...stepUp }, 200);
    }

    Object.assign(authRecord, await createPasswordRecord(newPassword));
    await persistLocalAuthRecord(authRecord);

    return c.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return c.json({ error: "Failed to update password" }, 500);
  }
});

// ── Two-factor management & sensitive-action endpoints ───────────────────────

// Current security status for the signed-in user (keeps /auth/me unchanged).
app.get("/make-server-50b25a4f/auth/2fa/status", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const authRecord = await getLocalAuthRecordByUserId(user.id);
  if (!authRecord) {
    return c.json({ error: "Account not found" }, 404);
  }

  const backupCodesRemaining = Array.isArray(authRecord.backupCodes) ? authRecord.backupCodes.length : 0;
  return c.json({
    emailVerified: authRecord.emailVerified !== false,
    twoFactorEnabled: isTwoFactorEnabled(authRecord),
    twoFactorMethod: hasTotpEnrolled(authRecord) ? "totp" : isTwoFactorEnabled(authRecord) ? "email" : "none",
    hasTotp: hasTotpEnrolled(authRecord),
    backupCodesRemaining,
  });
});

// Begin TOTP enrollment: generate a secret (stored pending until verified).
app.post("/make-server-50b25a4f/auth/2fa/setup", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const authRecord = await getLocalAuthRecordByUserId(user.id);
    if (!authRecord) {
      return c.json({ error: "Account not found" }, 404);
    }

    const secret = generateTotpSecret();
    authRecord.totpPendingEnc = await encryptSecret(secret);
    await persistLocalAuthRecord(authRecord);

    const issuer = (Deno.env.get("APP_NAME") || "Campus Market").trim() || "Campus Market";
    return c.json({
      success: true,
      secret,
      otpauthUri: buildOtpauthUri(secret, authRecord.email, issuer),
      issuer,
      account: authRecord.email,
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return c.json({ error: "Could not start two-factor setup. Please try again." }, 500);
  }
});

// Confirm TOTP enrollment with a code, enable 2FA, and return backup codes once.
app.post("/make-server-50b25a4f/auth/2fa/enable", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!TWO_FACTOR_CODE_PATTERN.test(code)) {
      return c.json({ error: "Enter the 6-digit code from your authenticator app." }, 400);
    }

    const authRecord = await getLocalAuthRecordByUserId(user.id);
    if (!authRecord) {
      return c.json({ error: "Account not found" }, 404);
    }
    if (!authRecord.totpPendingEnc) {
      return c.json({ error: "Start two-factor setup first." }, 400);
    }

    const pendingSecret = await decryptSecret(authRecord.totpPendingEnc);
    if (!pendingSecret || !(await verifyTotpCode(pendingSecret, code))) {
      return c.json({ error: "That code did not match. Check your authenticator app and try again." }, 400);
    }

    const backupCodes = generateBackupCodes();
    authRecord.totpSecretEnc = authRecord.totpPendingEnc;
    delete authRecord.totpPendingEnc;
    authRecord.twoFactorEnabled = true;
    authRecord.twoFactorMethod = "totp";
    authRecord.backupCodes = await hashBackupCodes(backupCodes);
    authRecord.twoFactorEnabledAt = new Date().toISOString();
    await persistLocalAuthRecord(authRecord);

    return c.json({
      success: true,
      message: "Two-factor authentication is now enabled.",
      backupCodes,
    });
  } catch (error) {
    console.error("2FA enable error:", error);
    return c.json({ error: "Could not enable two-factor authentication. Please try again." }, 500);
  }
});

// Disable 2FA — gated by a fresh challenge (authenticator/backup or email code).
app.post("/make-server-50b25a4f/auth/2fa/disable", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const authRecord = await getLocalAuthRecordByUserId(user.id);
    if (!authRecord) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (!isTwoFactorEnabled(authRecord)) {
      return c.json({ success: true, message: "Two-factor authentication is already disabled." });
    }

    const challengeCode = typeof body?.challengeCode === "string" ? body.challengeCode : "";
    const stepUp = await evaluateStepUp(authRecord, challengeCode);
    if (!stepUp.ok) {
      return c.json({ success: false, ...stepUp }, 200);
    }

    authRecord.twoFactorEnabled = false;
    authRecord.twoFactorMethod = "none";
    delete authRecord.totpSecretEnc;
    delete authRecord.totpPendingEnc;
    authRecord.backupCodes = [];
    authRecord.twoFactorDisabledAt = new Date().toISOString();
    await persistLocalAuthRecord(authRecord);

    return c.json({ success: true, message: "Two-factor authentication has been disabled." });
  } catch (error) {
    console.error("2FA disable error:", error);
    return c.json({ error: "Could not disable two-factor authentication. Please try again." }, 500);
  }
});

// Regenerate backup codes — gated by a fresh challenge; invalidates old codes.
app.post("/make-server-50b25a4f/auth/2fa/backup-codes/regenerate", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const authRecord = await getLocalAuthRecordByUserId(user.id);
    if (!authRecord) {
      return c.json({ error: "Account not found" }, 404);
    }
    if (!hasTotpEnrolled(authRecord)) {
      return c.json({ error: "Enable an authenticator app before generating backup codes." }, 400);
    }

    const challengeCode = typeof body?.challengeCode === "string" ? body.challengeCode : "";
    const stepUp = await evaluateStepUp(authRecord, challengeCode);
    if (!stepUp.ok) {
      return c.json({ success: false, ...stepUp }, 200);
    }

    const backupCodes = generateBackupCodes();
    authRecord.backupCodes = await hashBackupCodes(backupCodes);
    await persistLocalAuthRecord(authRecord);

    return c.json({ success: true, message: "New backup codes generated.", backupCodes });
  } catch (error) {
    console.error("Backup code regenerate error:", error);
    return c.json({ error: "Could not regenerate backup codes. Please try again." }, 500);
  }
});

// Change email — gated by a step-up challenge; new address must be re-verified.
app.post("/make-server-50b25a4f/auth/change-email", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const newEmail = normalizeEmail(body?.newEmail);
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";

    if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      return c.json({ error: "Enter a valid new email address." }, 400);
    }

    const authRecord = await getLocalAuthRecordByUserId(user.id);
    if (!authRecord) {
      return c.json({ error: "Account not found" }, 404);
    }

    if (normalizeEmail(authRecord.email) === newEmail) {
      return c.json({ error: "That is already your email address." }, 400);
    }

    // Confirm identity with the current password first.
    if (!(await verifyPassword(currentPassword, authRecord))) {
      return c.json({ error: "Current password is incorrect." }, 400);
    }

    // The new address must not already belong to someone else.
    const conflict = await getLocalAuthRecordByEmail(newEmail);
    const conflictProfile = await findUserProfileByEmail(newEmail);
    if ((conflict && conflict.userId !== authRecord.userId) || (conflictProfile && conflictProfile.id !== authRecord.userId)) {
      return c.json({ error: "An account with that email already exists." }, 409);
    }

    const challengeCode = typeof body?.challengeCode === "string" ? body.challengeCode : "";
    const stepUp = await evaluateStepUp(authRecord, challengeCode);
    if (!stepUp.ok) {
      return c.json({ success: false, ...stepUp }, 200);
    }

    const previousEmail = normalizeEmail(authRecord.email);
    authRecord.email = newEmail;
    authRecord.emailVerified = false;
    authRecord.emailConfirmedAt = "";
    await persistLocalAuthRecord(authRecord);
    // Drop the stale email→userId index pointing at the old address.
    if (previousEmail && previousEmail !== newEmail) {
      await kv.del(authEmailKey(previousEmail));
    }

    // Keep the user profile's email in sync.
    const profile = await getUserProfile(authRecord.userId);
    if (profile) {
      profile.email = newEmail;
      await kv.set(`user:${authRecord.userId}`, profile);
    }

    // Send a verification code to the new address.
    const delivery = await sendEmailVerificationChallenge(authRecord.userId, newEmail);
    return c.json({
      success: true,
      email: newEmail,
      requiresEmailVerification: true,
      message:
        delivery.deliveryMethod === "email"
          ? "Email updated. We sent a verification code to your new address — verify it to keep full access."
          : "Email updated. Use the verification code below to confirm your new address.",
      ...(delivery.deliveryMethod === "fallback" ? { verificationCode: delivery.code } : {}),
    });
  } catch (error) {
    console.error("Change email error:", error);
    return c.json({ error: "Could not change email. Please try again." }, 500);
  }
});

// Get user profile by ID
app.get("/make-server-50b25a4f/users/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const profile = await getUserProfile(id);
    
    if (!profile) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: profile });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Failed to get user' }, 500);
  }
});

// ============ ITEM LISTING ROUTES ============

// Create new listing
app.post("/make-server-50b25a4f/listings", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { title, description, category, price, type, rentalPeriod, location, condition, images } = body;

    const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const listing = {
      id: itemId,
      title,
      description,
      category,
      price: parseFloat(price),
      type,
      rentalPeriod,
      location,
      condition,
      images: images || [],
      sellerId: user.id,
      status: 'available',
      views: 0,
      likesCount: 0,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`listing:${itemId}`, listing);

    // Add to user's listings
    const userListings = await kv.get(`user:${user.id}:listings`) || [];
    userListings.push(itemId);
    await kv.set(`user:${user.id}:listings`, userListings);

    return c.json({ success: true, listing });
  } catch (error) {
    console.error('Create listing error:', error);
    return c.json({ error: 'Failed to create listing' }, 500);
  }
});

// Get all listings
app.get("/make-server-50b25a4f/listings", async (c) => {
  try {
    let listings = await kv.getByPrefix('listing:');
    if (Array.isArray(listings)) {
      listings = listings.filter((listing: any) => !isDemoMarketplaceListing(listing));
    }
    const sellerCache = new Map<string, any | null>();
    const enriched: any[] = [];

    for (const listing of listings || []) {
      if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
        continue;
      }

      // Skip sold or rented listings — they should not appear in the marketplace.
      if (listing.status && listing.status !== 'available') {
        continue;
      }

      try {
        const value = await enrichListing(listing, sellerCache);
        if (value && value.status === 'available') {
          enriched.push(value);
        }
      } catch (error) {
        const listingId = typeof listing.id === 'string' ? listing.id : 'unknown';
        console.error(`Get listings enrich error (${listingId}):`, error);
      }
    }

    return c.json({ listings: enriched });
  } catch (error) {
    console.error('Get listings error:', error);
    return c.json(internalErrorPayload('Failed to get listings', error), 500);
  }
});

// Get current user's listings
app.get("/make-server-50b25a4f/listings/user", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const listingIds = (await kv.get(`user:${user.id}:listings`)) || [];
    const listings = await Promise.all(
      listingIds.map(async (id: string) => await kv.get(`listing:${id}`)),
    );
    const enriched = await Promise.all(
      listings.filter((listing: any) => listing).map(async (listing: any) => await enrichListing(listing)),
    );
    return c.json({ listings: enriched });
  } catch (error) {
    console.error('Get user listings error:', error);
    return c.json({ error: 'Failed to get your listings' }, 500);
  }
});

// Get single listing
app.get("/make-server-50b25a4f/listings/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const listing = await kv.get(`listing:${id}`);
    
    if (!listing || isDemoMarketplaceListing(listing)) {
      return c.json({ error: 'Listing not found' }, 404);
    }

    return c.json({ listing: await enrichListing(listing) });
  } catch (error) {
    console.error('Get listing error:', error);
    return c.json({ error: 'Failed to get listing' }, 500);
  }
});

// Register a manual listing view
app.post("/make-server-50b25a4f/listings/:id/view", async (c) => {
  try {
    const id = c.req.param('id');
    const listing = await kv.get(`listing:${id}`);

    if (!listing) {
      return c.json({ error: 'Listing not found' }, 404);
    }

    listing.views = Math.max(0, toSafeNumber(listing.views, 0)) + 1;
    await kv.set(`listing:${id}`, listing);

    return c.json({ success: true, views: listing.views });
  } catch (error) {
    console.error('Record listing view error:', error);
    return c.json({ error: 'Failed to record listing view' }, 500);
  }
});

// Update listing
app.put("/make-server-50b25a4f/listings/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    const listing = await kv.get(`listing:${id}`);

    if (!listing) {
      return c.json({ error: "Listing not found" }, 404);
    }

    const userProfile = await getUserProfile(user.id);
    if (listing.sellerId !== user.id && userProfile?.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const next = { ...listing };

    const setTextField = (field: string) => {
      if (typeof body?.[field] === "string") {
        const value = body[field].trim();
        if (value) next[field] = value;
      }
    };

    setTextField("title");
    setTextField("description");
    setTextField("category");
    setTextField("location");
    setTextField("condition");

    if (typeof body?.type === "string") {
      next.type = body.type === "rent" ? "rent" : "sell";
    }
    if (typeof body?.rentalPeriod === "string") {
      next.rentalPeriod = body.rentalPeriod === "daily" || body.rentalPeriod === "weekly" ? body.rentalPeriod : "monthly";
    }
    if (next.type !== "rent") {
      next.rentalPeriod = "";
    }

    if (body?.price !== undefined) {
      const parsedPrice = Number(String(body.price).replace(/\s+/g, "").replace(",", "."));
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        return c.json({ error: "Price must be greater than 0" }, 400);
      }
      next.price = parsedPrice;
    }

    if (Array.isArray(body?.images)) {
      const images = body.images
        .filter((image: any) => typeof image === "string")
        .map((image: string) => image.trim())
        .filter((image: string) => image.length > 0)
        .slice(0, 8);
      next.images = images;
    }

    if (typeof body?.status === "string") {
      const allowedStatuses = new Set(["available", "sold", "rented", "reserved", "inactive"]);
      const normalizedStatus = body.status.trim().toLowerCase();
      if (!allowedStatuses.has(normalizedStatus)) {
        return c.json({ error: "Invalid listing status" }, 400);
      }
      next.status = normalizedStatus;
    }

    next.updatedAt = new Date().toISOString();
    await kv.set(`listing:${id}`, next);

    return c.json({ success: true, listing: await enrichListing(next) });
  } catch (error) {
    console.error("Update listing error:", error);
    return c.json({ error: "Failed to update listing" }, 500);
  }
});

// Delete listing
app.delete("/make-server-50b25a4f/listings/:id", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const listing = await kv.get(`listing:${id}`);
    
    if (!listing) {
      return c.json({ error: 'Listing not found' }, 404);
    }

    const userProfile = await getUserProfile(user.id);
    
    // Check if user is the seller or admin
    if (listing.sellerId !== user.id && userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await kv.del(`listing:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete listing error:', error);
    return c.json({ error: 'Failed to delete listing' }, 500);
  }
});

// ============ MESSAGING ROUTES ============

// Send message
app.post("/make-server-50b25a4f/messages", async (c) => {
  const user = await verifyMessagingAuth(
    c.req.header("Authorization"),
    c.req.header("x-refresh-token"),
  );
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const receiverId = typeof body?.receiverId === 'string' ? body.receiverId.trim() : '';
    const itemId = typeof body?.itemId === 'string' && body.itemId.trim() ? body.itemId.trim() : undefined;
    const messageType = body?.messageType === 'voice' || body?.messageType === 'image' ? body.messageType : 'text';
    const rawContent = typeof body?.content === 'string' ? body.content.trim() : '';
    const audioData = typeof body?.audioData === 'string' ? body.audioData : null;
    const attachmentData = typeof body?.attachmentData === 'string' ? body.attachmentData : null;

    if (!receiverId) {
      return c.json({ error: 'Receiver is required' }, 400);
    }

    if (receiverId === user.id) {
      return c.json({ error: 'You cannot message yourself' }, 400);
    }

    if (messageType === 'voice' && !audioData) {
      return c.json({ error: 'Voice message data is required' }, 400);
    }

    if (messageType === 'image' && !attachmentData) {
      return c.json({ error: 'Image attachment data is required' }, 400);
    }

    const content =
      rawContent ||
      (messageType === 'voice'
        ? 'Voice message'
        : messageType === 'image'
          ? 'Sent an image'
          : '');

    if (!content) {
      return c.json({ error: 'Message content is required' }, 400);
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const message = {
      id: messageId,
      senderId: user.id,
      receiverId,
      itemId,
      content,
      messageType,
      audioData: messageType === 'voice' ? audioData : null,
      attachmentData: messageType === 'image' ? attachmentData : null,
      timestamp: new Date().toISOString(),
      read: false,
      isEdited: false,
      isDeleted: false,
    };

    try {
      await kv.set(`message:${messageId}`, message);

      // Add to both users' message lists using atomic append to avoid
      // dropped IDs when multiple signaling messages (ICE) arrive quickly.
      await Promise.all([
        kv.appendUniqueStringToArray(`user:${user.id}:messages`, messageId),
        kv.appendUniqueStringToArray(`user:${receiverId}:messages`, messageId),
      ]);
    } catch (error) {
      console.error('KV store error, message not persisted:', error);
      // Still return success so signaling can proceed
    }

    // Push to recipient via WebSocket if they are connected — this makes
    // call signals (invite/accept/offer/answer/ICE) arrive in real-time
    // without waiting for the next 800ms poll cycle.
    wsBroadcastToUser(receiverId, { type: "new_message", message });
    // Also echo to sender so their own UI updates instantly.
    wsBroadcastToUser(user.id, { type: "new_message", message });

    return c.json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

// Get user's messages
app.get("/make-server-50b25a4f/messages", async (c) => {
  const user = await verifyMessagingAuth(
    c.req.header("Authorization"),
    c.req.header("x-refresh-token"),
  );
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const rawMessageIds = await kv.get(`user:${user.id}:messages`);
    const messageIds = Array.isArray(rawMessageIds)
      ? Array.from(new Set(rawMessageIds.filter((id: unknown): id is string => typeof id === 'string')))
      : [];
    const messages = await Promise.all(
      messageIds.map(async (id) => await kv.get(`message:${id}`))
    );
    const normalizedMessages = messages
      .filter((m: any) =>
        m &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        typeof m.senderId === 'string' &&
        typeof m.receiverId === 'string' &&
        typeof m.content === 'string',
      )
      .map((m: any) => ({
        ...m,
        messageType: m.messageType === 'voice' || m.messageType === 'image' ? m.messageType : 'text',
        audioData: typeof m.audioData === 'string' ? m.audioData : null,
        attachmentData: typeof m.attachmentData === 'string' ? m.attachmentData : null,
        isEdited: Boolean(m.isEdited),
        isDeleted: Boolean(m.isDeleted),
      }))
      .sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    return c.json({ messages: normalizedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    // Return empty list if KV is unavailable
    return c.json({ messages: [] });
  }
});

// Mark message as read
app.put("/make-server-50b25a4f/messages/:id/read", async (c) => {
  const user = await verifyMessagingAuth(
    c.req.header("Authorization"),
    c.req.header("x-refresh-token"),
  );
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const message = await kv.get(`message:${id}`);
    
    if (!message) {
      return c.json({ error: 'Message not found' }, 404);
    }

    if (message.receiverId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    message.read = true;
    await kv.set(`message:${id}`, message);

    return c.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return c.json({ error: 'Failed to mark message as read' }, 500);
  }
});

// Edit message content
app.put("/make-server-50b25a4f/messages/:id", async (c) => {
  const user = await verifyMessagingAuth(
    c.req.header("Authorization"),
    c.req.header("x-refresh-token"),
  );

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const message = await kv.get(`message:${id}`);
    if (!message) {
      return c.json({ error: 'Message not found' }, 404);
    }

    const profile = await getUserProfile(user.id);
    const isAdmin = profile?.role === 'admin';
    if (message.senderId !== user.id && !isAdmin) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return c.json({ error: 'Message content is required' }, 400);
    }

    const updated = {
      ...message,
      content,
      isEdited: true,
      editedAt: new Date().toISOString(),
    };
    await kv.set(`message:${id}`, updated);
    return c.json({ success: true, message: updated });
  } catch (error) {
    console.error('Edit message error:', error);
    return c.json({ error: 'Failed to edit message' }, 500);
  }
});

// Delete message (soft delete)
app.delete("/make-server-50b25a4f/messages/:id", async (c) => {
  const user = await verifyMessagingAuth(
    c.req.header("Authorization"),
    c.req.header("x-refresh-token"),
  );

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const message = await kv.get(`message:${id}`);
    if (!message) {
      return c.json({ error: 'Message not found' }, 404);
    }

    const profile = await getUserProfile(user.id);
    const isAdmin = profile?.role === 'admin';
    if (message.senderId !== user.id && !isAdmin) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updated = {
      ...message,
      content: 'This message was deleted',
      messageType: 'text',
      audioData: null,
      attachmentData: null,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
    };
    await kv.set(`message:${id}`, updated);
    return c.json({ success: true, message: updated });
  } catch (error) {
    console.error('Delete message error:', error);
    return c.json({ error: 'Failed to delete message' }, 500);
  }
});

// Delete a conversation for the current user only
app.delete("/make-server-50b25a4f/conversations/:otherUserId", async (c) => {
  const user = await verifyMessagingAuth(
    c.req.header("Authorization"),
    c.req.header("x-refresh-token"),
  );

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const otherUserId = c.req.param('otherUserId');
    if (!otherUserId) {
      return c.json({ error: 'Conversation user is required' }, 400);
    }

    const rawMessageIds = await kv.get(`user:${user.id}:messages`);
    const messageIds = Array.isArray(rawMessageIds)
      ? Array.from(new Set(rawMessageIds.filter((id: unknown): id is string => typeof id === "string")))
      : [];
    const keptIds: string[] = [];
    let removedCount = 0;

    for (const messageId of messageIds) {
      const message = await kv.get(`message:${messageId}`);
      if (!message) continue;

      const isConversationMessage =
        (message.senderId === user.id && message.receiverId === otherUserId) ||
        (message.senderId === otherUserId && message.receiverId === user.id);

      if (isConversationMessage) {
        removedCount += 1;
        continue;
      }

      keptIds.push(messageId);
    }

    await kv.set(`user:${user.id}:messages`, keptIds);

    return c.json({ success: true, removedCount });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return c.json({ error: 'Failed to delete conversation' }, 500);
  }
});

// ============ ESCROW, ORDERS, AND WALLET ROUTES ============

async function createEscrowOrderForBuyer(user: any, body: any) {
  const itemId = body?.itemId;
  const paymentMethod = body?.paymentMethod === "orange-money" ? "orange-money" : "mtn-momo";
  const phoneNumber = normalizePhone(body?.phoneNumber);
  const pickupDate = typeof body?.pickupDate === "string" ? body.pickupDate : "";
  const pickupTime = typeof body?.pickupTime === "string" ? body.pickupTime : "";
  const pickupLocation = typeof body?.pickupLocation === "string" ? body.pickupLocation : "";
  const pickupLatitude = body?.pickupLatitude;
  const pickupLongitude = body?.pickupLongitude;
  const pickupPlaceId = typeof body?.pickupPlaceId === "string" ? body.pickupPlaceId : "";
  const pickupAddress = typeof body?.pickupAddress === "string" ? body.pickupAddress : "";

  if (!itemId) {
    throw new Error("Item ID is required");
  }
  if (!isValidCameroonPhone(phoneNumber)) {
    throw new Error("A valid Cameroon phone number is required");
  }
  if (!pickupDate || !pickupTime || !pickupLocation) {
    throw new Error("Pickup date, time, and location are required");
  }
  if (!isAllowedPickupLocation(pickupLocation, pickupLatitude, pickupLongitude)) {
    throw new Error("Pickup location must be a public campus or roundabout in Cameroon");
  }

  const listing = await kv.get(`listing:${itemId}`);
  if (!listing) {
    throw new Error("Listing not found");
  }
  if (listing.status !== "available") {
    throw new Error("Listing is no longer available");
  }
  if (listing.sellerId === user.id) {
    throw new Error("You cannot buy your own listing");
  }

  const buyerProfile = await getUserProfile(user.id);
  const sellerProfile = await getUserProfile(listing.sellerId);
  if (!buyerProfile || !sellerProfile) {
    throw new Error("Buyer or seller profile not found");
  }
  if (sellerProfile.isBanned) {
    throw new Error("This seller account is unavailable");
  }

  const amount = roundXafAmount(listing.price);
  const transactionFee = calculateTransactionFee(amount);
  const totalCharged = roundXafAmount(amount + transactionFee);
  // Seller receives full item amount; platform revenue comes from buyer transaction fee.
  const platformFee = 0;
  const sellerNetAmount = amount;
  const orderId = createEntityId("ORD");
  const escrowId = createEntityId("ESC");
  const transactionRef = `${paymentMethod.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  // All payments now go through Fapshi Direct Pay (API). Manual USSD removed.
  // After paying on Fapshi's hosted page, the buyer is redirected back to the
  // order page where the status self-reconciles. appOrigin is the frontend URL.
  const appOrigin = typeof body?.appOrigin === "string" ? body.appOrigin.replace(/\/+$/, "") : "";
  const paymentResult = await processInboundMobileMoneyPayment({
    amount: totalCharged,
    phoneNumber,
    provider: paymentMethod,
    reference: transactionRef,
    description: `Escrow payment for ${listing.title || "marketplace item"}`,
    buyerName: buyerProfile.name,
    buyerEmail: buyerProfile.email,
    userId: user.id,
    redirectUrl: appOrigin ? `${appOrigin}/orders/${orderId}` : undefined,
  });
  const now = new Date().toISOString();
  // Fapshi confirms asynchronously (status "pending") via webhook. Only mock mode
  // returns "successful" synchronously. Escrow hold + seller credit are deferred
  // to confirmEscrowOrderPaid() until payment is confirmed.
  const paymentConfirmed = paymentResult.status === "successful";
  const paymentLink = (paymentResult as any).paymentLink || "";

  const awaitingSync = {
    provider: "pending",
    synced: false,
    action: "hold",
    status: "awaiting_payment",
    reference: "",
    raw: null,
    syncedAt: now,
  };

  const order = {
    id: orderId,
    escrowId,
    itemId,
    buyerId: user.id,
    sellerId: listing.sellerId,
    amount,
    transactionFee,
    totalCharged,
    platformFee,
    sellerNetAmount,
    paymentMethod,
    phoneNumber,
    transactionRef,
    paymentProvider: paymentResult.provider,
    paymentProviderStatus: paymentResult.status,
    paymentProviderReference: paymentResult.reference,
    paymentProviderResponse: paymentResult.raw,
    paymentLink,
    merchantMoMoName: MERCHANT_MOMO_NAME,
    merchantMoMoNumber: MERCHANT_MOMO_NUMBER,
    status: ORDER_STATUS.AWAITING_PAYMENT,
    statusLabel: normalizeOrderStatusLabel(ORDER_STATUS.AWAITING_PAYMENT),
    buyerName: buyerProfile.name,
    buyerProfilePicture: buyerProfile.profilePicture || buyerProfile.avatar || "",
    buyerPhoneNumber: buyerProfile.phone || phoneNumber,
    pickupLocation,
    pickupAddress,
    pickupLatitude: pickupLatitude ?? null,
    pickupLongitude: pickupLongitude ?? null,
    pickupPlaceId,
    pickupDate,
    pickupTime,
    deliveryProofUrl: "",
    sellerProofUploaded: false,
    sellerDeliveredAt: "",
    buyerConfirmedAt: "",
    buyerSatisfied: false,
    refundReason: "",
    escrowProvider: awaitingSync.provider,
    escrowProviderStatus: awaitingSync.status,
    escrowProviderReference: awaitingSync.reference,
    escrowProviderSynced: awaitingSync.synced,
    escrowProviderUpdatedAt: awaitingSync.syncedAt,
    escrowProviderMeta: awaitingSync,
    createdAt: now,
    updatedAt: now,
  };

  const escrowTransaction = {
    id: escrowId,
    orderId,
    buyer_id: user.id,
    seller_id: listing.sellerId,
    amount,
    transaction_fee: transactionFee,
    total_charged: totalCharged,
    platform_fee: platformFee,
    seller_net_amount: sellerNetAmount,
    status: ESCROW_STATUS.AWAITING,
    proof_image_url: "",
    pickup_location: pickupLocation,
    pickup_date: pickupDate,
    pickup_time: pickupTime,
    pickup_latitude: pickupLatitude ?? null,
    pickup_longitude: pickupLongitude ?? null,
    payment_method: paymentMethod,
    buyer_phone: phoneNumber,
    provider: paymentResult.provider,
    provider_status: paymentResult.status,
    provider_reference: paymentResult.reference,
    provider_payload: paymentResult.raw,
    provider_sync: {
      hold: awaitingSync,
      latest: awaitingSync,
      updatedAt: now,
    },
    created_at: now,
    updated_at: now,
  };

  await kv.set(`order:${orderId}`, order);
  await kv.set(`escrow:${escrowId}`, escrowTransaction);
  await kv.set(`transaction:${orderId}`, buildLegacyTransaction(order));

  // Reserve the listing immediately so a second buyer cannot purchase the same
  // item while this payment is being confirmed. Freed again on FAILED/EXPIRED.
  listing.status = listing.type === "sell" ? "sold" : "rented";
  listing.reservedBy = user.id;
  listing.updatedAt = now;
  await kv.set(`listing:${itemId}`, listing);

  const buyerOrders = (await kv.get(`user:${user.id}:orders`)) || [];
  if (!buyerOrders.includes(orderId)) {
    buyerOrders.push(orderId);
    await kv.set(`user:${user.id}:orders`, buyerOrders);
  }

  const sellerOrders = (await kv.get(`user:${listing.sellerId}:orders`)) || [];
  if (!sellerOrders.includes(orderId)) {
    sellerOrders.push(orderId);
    await kv.set(`user:${listing.sellerId}:orders`, sellerOrders);
  }

  const buyerTxns = (await kv.get(`user:${user.id}:transactions`)) || [];
  if (!buyerTxns.includes(orderId)) {
    buyerTxns.push(orderId);
    await kv.set(`user:${user.id}:transactions`, buyerTxns);
  }

  const sellerTxns = (await kv.get(`user:${listing.sellerId}:transactions`)) || [];
  if (!sellerTxns.includes(orderId)) {
    sellerTxns.push(orderId);
    await kv.set(`user:${listing.sellerId}:transactions`, sellerTxns);
  }

  // Index the Fapshi transaction id so the webhook can resolve this order.
  if (paymentResult.provider === "fapshi" && paymentResult.reference) {
    await kv.set(`fapshi:tx:${paymentResult.reference}`, {
      type: "order",
      orderId,
      escrowId,
      createdAt: now,
    });
  }

  const listingTitle = listing.title || "your item";

  if (paymentConfirmed) {
    // Mock/synchronous success — confirm immediately via the shared path.
    const confirmed = await confirmEscrowOrderPaid(orderId);
    return {
      order: confirmed?.order || order,
      escrowTransaction: confirmed?.escrow || escrowTransaction,
    };
  }

  // Real Fapshi Direct Pay: tell the buyer to approve the prompt on their phone.
  // The seller is notified only once payment is confirmed by the webhook.
  await createUserNotification(user.id, {
    type: "payment_pending",
    title: "Approve the payment on your phone",
    message: `Confirm the Fapshi payment prompt on your phone to complete your order for ${listingTitle}.`,
    priority: "high",
    data: {
      orderId,
      itemId,
      transId: paymentResult.reference,
    },
  });

  return { order, escrowTransaction };
}

// Apply all "payment confirmed" side effects exactly once: escrow hold sync,
// wallet credits, listing reservation, status flip, and notifications. Safe to
// call repeatedly — it no-ops unless the escrow is still AWAITING.
async function confirmEscrowOrderPaid(orderId: string) {
  const order = await kv.get(`order:${orderId}`);
  if (!order) return null;
  const escrow = await kv.get(`escrow:${order.escrowId}`);
  if (!escrow) return null;
  if (escrow.status !== ESCROW_STATUS.AWAITING) {
    // Already confirmed (or voided) — idempotent no-op.
    return { order, escrow, alreadyConfirmed: true };
  }

  const now = new Date().toISOString();
  const amount = roundXafAmount(order.amount);
  const transactionFee = roundXafAmount(order.transactionFee);
  const buyerProfile = await getUserProfile(order.buyerId);
  const sellerProfile = await getUserProfile(order.sellerId);

  const escrowProviderSync = await syncEscrowProvider("hold", {
    escrowId: order.escrowId,
    orderId,
    amount,
    transactionFee,
    totalCharged: roundXafAmount(order.totalCharged),
    platformFee: order.platformFee || 0,
    sellerNetAmount: roundXafAmount(order.sellerNetAmount),
    currency: "XAF",
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentProviderReference || order.transactionRef,
    pickupDate: order.pickupDate,
    pickupTime: order.pickupTime,
    pickupLocation: order.pickupLocation,
  });

  // Credit platform transaction fee and the seller's pending balance.
  if (transactionFee > 0) {
    await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: transactionFee });
  }
  await adjustWallet(order.sellerId, { pendingDelta: amount });

  // Keep the listing reserved/sold (it was reserved at order creation).
  const listing = await kv.get(`listing:${order.itemId}`);
  if (listing && typeof listing === "object") {
    listing.status = listing.type === "sell" ? "sold" : "rented";
    listing.reservedBy = order.buyerId;
    listing.updatedAt = now;
    await kv.set(`listing:${order.itemId}`, listing);
  }

  const escrowProviderSyncMeta = escrowProviderSync;
  const updatedOrder = {
    ...order,
    status: ORDER_STATUS.PAID_PENDING_DELIVERY,
    statusLabel: normalizeOrderStatusLabel(ORDER_STATUS.PAID_PENDING_DELIVERY),
    paymentProviderStatus: "successful",
    paidAt: now,
    escrowProvider: escrowProviderSyncMeta.provider,
    escrowProviderStatus: escrowProviderSyncMeta.status,
    escrowProviderReference: escrowProviderSyncMeta.reference,
    escrowProviderSynced: escrowProviderSyncMeta.synced,
    escrowProviderUpdatedAt: escrowProviderSyncMeta.syncedAt,
    escrowProviderMeta: escrowProviderSyncMeta,
    updatedAt: now,
  };

  const previousProviderSync =
    escrow?.provider_sync && typeof escrow.provider_sync === "object" && !Array.isArray(escrow.provider_sync)
      ? escrow.provider_sync
      : {};
  const updatedEscrow = {
    ...escrow,
    status: ESCROW_STATUS.PENDING,
    provider_status: "successful",
    provider_sync: {
      ...previousProviderSync,
      hold: escrowProviderSyncMeta,
      latest: escrowProviderSyncMeta,
      updatedAt: now,
    },
    updated_at: now,
  };

  await kv.set(`order:${orderId}`, updatedOrder);
  await kv.set(`escrow:${order.escrowId}`, updatedEscrow);
  await kv.set(`transaction:${orderId}`, buildLegacyTransaction(updatedOrder));

  const listingTitle = listing?.title || "your item";
  await createUserNotification(order.sellerId, {
    type: "order_created",
    title: "New order received",
    message: `${buyerProfile?.name || "A buyer"} placed an order for ${listingTitle}.`,
    priority: "high",
    data: {
      orderId,
      itemId: order.itemId,
      buyerId: order.buyerId,
      buyerName: buyerProfile?.name || "",
    },
  });
  await createUserNotification(order.buyerId, {
    type: "order_paid",
    title: "Payment received in escrow",
    message: `Your payment for ${listingTitle} is secured. Wait for seller delivery proof.`,
    priority: "normal",
    data: {
      orderId,
      itemId: order.itemId,
      sellerId: order.sellerId,
      sellerName: sellerProfile?.name || "",
    },
  });

  await recordPaymentAudit("order_confirmed", {
    orderId,
    escrowId: order.escrowId,
    transId: order.paymentProviderReference,
    amount,
  });

  return { order: updatedOrder, escrow: updatedEscrow, confirmed: true };
}

// Cancel an order whose Fapshi payment failed/expired. No wallet was credited
// while AWAITING, so we only free the reserved listing and mark the records void.
async function voidAwaitingEscrowOrder(orderId: string, reason: string, providerStatus?: string) {
  const order = await kv.get(`order:${orderId}`);
  if (!order) return null;
  const escrow = await kv.get(`escrow:${order.escrowId}`);
  if (escrow && escrow.status !== ESCROW_STATUS.AWAITING) {
    // Already confirmed or already voided — never touch a paid order.
    return { order, escrow, skipped: true };
  }
  const now = new Date().toISOString();

  const listing = await kv.get(`listing:${order.itemId}`);
  if (listing && typeof listing === "object" && listing.reservedBy === order.buyerId) {
    listing.status = "available";
    listing.reservedBy = "";
    listing.updatedAt = now;
    await kv.set(`listing:${order.itemId}`, listing);
  }

  const updatedOrder = {
    ...order,
    status: ORDER_STATUS.PAYMENT_FAILED,
    statusLabel: normalizeOrderStatusLabel(ORDER_STATUS.PAYMENT_FAILED),
    paymentProviderStatus: providerStatus || "failed",
    paymentFailedReason: reason,
    updatedAt: now,
  };
  await kv.set(`order:${orderId}`, updatedOrder);
  if (escrow) {
    await kv.set(`escrow:${order.escrowId}`, {
      ...escrow,
      status: ESCROW_STATUS.VOIDED,
      voided_at: now,
      void_reason: reason,
      provider_status: providerStatus || "failed",
      updated_at: now,
    });
  }
  await kv.set(`transaction:${orderId}`, buildLegacyTransaction(updatedOrder));

  await createUserNotification(order.buyerId, {
    type: "payment_failed",
    title: "Payment not completed",
    message: `Your payment could not be completed (${reason}). The item has been released — please try again.`,
    priority: "high",
    data: { orderId, itemId: order.itemId },
  });

  await recordPaymentAudit("order_failed", {
    orderId,
    escrowId: order.escrowId,
    transId: order.paymentProviderReference,
    reason,
  });

  return { order: updatedOrder, voided: true };
}

async function releaseEscrowOrder(order: any, actorId: string) {
  const escrow = await kv.get(`escrow:${order.escrowId}`);
  if (!escrow || escrow.status !== ESCROW_STATUS.PENDING) {
    throw new Error("Escrow is not pending");
  }

  const settings = await getAdminSettings();
  const amount = roundXafAmount(order.amount);
  // Seller receives full item amount on release; no seller-side commission deduction.
  const platformFee = 0;
  const sellerNetAmount = amount;
  const now = new Date().toISOString();

  const escrowProviderSync = await syncEscrowProvider("release", {
    escrowId: order.escrowId,
    orderId: order.id,
    amount,
    platformFee,
    sellerNetAmount,
    currency: "XAF",
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    actorId,
    deliveryProofUrl: order.deliveryProofUrl || escrow?.proof_image_url || "",
    buyerConfirmedAt: order.buyerConfirmedAt || now,
  });

  await adjustWallet(order.sellerId, { pendingDelta: -amount, availableDelta: sellerNetAmount });
  await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: platformFee });

  const previousProviderSync =
    escrow?.provider_sync && typeof escrow.provider_sync === "object" && !Array.isArray(escrow.provider_sync)
      ? escrow.provider_sync
      : {};

  const updatedEscrow = {
    ...escrow,
    status: ESCROW_STATUS.RELEASED,
    platform_fee: platformFee,
    seller_net_amount: sellerNetAmount,
    released_at: now,
    updated_at: now,
    released_by: actorId,
    provider_release_status: escrowProviderSync.status,
    provider_release_reference: escrowProviderSync.reference,
    provider_release_synced: escrowProviderSync.synced,
    provider_release_at: escrowProviderSync.syncedAt,
    provider_sync: {
      ...previousProviderSync,
      release: escrowProviderSync,
      latest: escrowProviderSync,
      updatedAt: now,
    },
  };
  await kv.set(`escrow:${order.escrowId}`, updatedEscrow);

  const updatedOrder = {
    ...order,
    status: ORDER_STATUS.DELIVERED_RELEASED,
    statusLabel: normalizeOrderStatusLabel(ORDER_STATUS.DELIVERED_RELEASED),
    platformFee,
    sellerNetAmount,
    releasedAt: now,
    escrowProviderStatus: escrowProviderSync.status,
    escrowProviderReference: escrowProviderSync.reference,
    escrowProviderSynced: escrowProviderSync.synced,
    escrowProviderUpdatedAt: escrowProviderSync.syncedAt,
    escrowReleaseMeta: escrowProviderSync,
    updatedAt: now,
  };

  // Auto payout to seller MoMo when escrow is released (both MTN and Orange).
  if (settings.autoPayoutToMobileMoney) {
    const sellerProfile = await getUserProfile(updatedOrder.sellerId);
    const sellerPhone = sellerProfile?.phone || "";
    if (isValidCameroonPhone(sellerPhone)) {
      const withdrawalId = createEntityId("WD");
      const availableWallet = await getWallet(updatedOrder.sellerId);
      const payoutAmount = roundXafAmount(sellerNetAmount);
      if (availableWallet.availableBalance >= payoutAmount && payoutAmount > 0) {
        const payoutReference = `AUTO-MTN-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        try {
          const payoutResult = await processOutboundMobileMoneyPayout({
            amount: payoutAmount,
            phoneNumber: sellerPhone,
            provider: updatedOrder.paymentMethod === "orange-money" ? "orange-money" : "mtn-momo",
            reference: payoutReference,
            description: `Escrow release — seller payout for order ${updatedOrder.id}`,
          });
          await adjustWallet(updatedOrder.sellerId, { availableDelta: -payoutAmount });
          // Fapshi payouts confirm asynchronously: only mark COMPLETED on a
          // synchronous success, otherwise PROCESSING until the webhook lands.
          const autoPayoutStatus = ["successful", "success", "completed"].includes(
            String(payoutResult.status || "").toLowerCase(),
          )
            ? WITHDRAWAL_STATUS.COMPLETED
            : WITHDRAWAL_STATUS.PROCESSING;
          const autoWithdrawal = {
            id: withdrawalId,
            userId: updatedOrder.sellerId,
            amount: payoutAmount,
            provider: "mtn-momo",
            phoneNumber: sellerPhone,
            status: autoPayoutStatus,
            source: "auto-release",
            reference: payoutResult.reference || payoutReference,
            providerStatus: payoutResult.status,
            providerName: payoutResult.provider,
            providerPayload: payoutResult.raw,
            note: "Automatic MTN payout after buyer confirmation",
            createdAt: now,
            updatedAt: now,
            processedBy: "system",
          };
          await kv.set(`withdrawal:${withdrawalId}`, autoWithdrawal);
          await indexFapshiPayout(payoutResult, withdrawalId);
          const sellerWithdrawals = (await kv.get(`user:${updatedOrder.sellerId}:withdrawals`)) || [];
          sellerWithdrawals.push(withdrawalId);
          await kv.set(`user:${updatedOrder.sellerId}:withdrawals`, sellerWithdrawals);
          updatedOrder.autoPayout = {
            provider: "mtn-momo",
            status: autoPayoutStatus,
            amount: payoutAmount,
            phoneNumber: sellerPhone,
            withdrawalId,
            providerReference: payoutResult.reference || payoutReference,
            processedAt: now,
          };
        } catch (error: any) {
          const failedWithdrawal = {
            id: withdrawalId,
            userId: updatedOrder.sellerId,
            amount: payoutAmount,
            provider: "mtn-momo",
            phoneNumber: sellerPhone,
            status: WITHDRAWAL_STATUS.FAILED,
            source: "auto-release",
            reference: payoutReference,
            note: "Automatic payout failed; seller can retry manually",
            error: error instanceof Error ? error.message : "Payout failed",
            createdAt: now,
            updatedAt: now,
            processedBy: "system",
          };
          await kv.set(`withdrawal:${withdrawalId}`, failedWithdrawal);
          const sellerWithdrawals = (await kv.get(`user:${updatedOrder.sellerId}:withdrawals`)) || [];
          sellerWithdrawals.push(withdrawalId);
          await kv.set(`user:${updatedOrder.sellerId}:withdrawals`, sellerWithdrawals);
          updatedOrder.autoPayout = {
            provider: "mtn-momo",
            status: WITHDRAWAL_STATUS.FAILED,
            amount: payoutAmount,
            phoneNumber: sellerPhone,
            withdrawalId,
            providerReference: payoutReference,
            error: error instanceof Error ? error.message : "Payout failed",
            processedAt: now,
          };
        }
      }
    }
  }

  await kv.set(`order:${updatedOrder.id}`, updatedOrder);
  await kv.set(`transaction:${updatedOrder.id}`, buildLegacyTransaction(updatedOrder));

  const commissionId = createEntityId("commission");
  const commissionLog = {
    id: commissionId,
    orderId: updatedOrder.id,
    escrowId: updatedOrder.escrowId,
    sellerId: updatedOrder.sellerId,
    buyerId: updatedOrder.buyerId,
    amount: platformFee,
    createdAt: now,
    type: "escrow-release-fee",
  };
  await kv.set(`commission:${commissionId}`, commissionLog);

  const releasedListing = await kv.get(`listing:${updatedOrder.itemId}`);
  const releasedTitle = releasedListing?.title || "your order";
  await createUserNotification(updatedOrder.sellerId, {
    type: "escrow_released",
    title: "Escrow released",
    message: `Funds for ${releasedTitle} are now available in your wallet.`,
    priority: "high",
    data: {
      orderId: updatedOrder.id,
      amount: sellerNetAmount,
      walletAction: "available_balance_increase",
    },
  });
  await createUserNotification(updatedOrder.buyerId, {
    type: "order_completed",
    title: "Order completed",
    message: `Thanks for confirming delivery of ${releasedTitle}.`,
    priority: "normal",
    data: {
      orderId: updatedOrder.id,
      sellerId: updatedOrder.sellerId,
    },
  });

  return { order: updatedOrder, escrow: updatedEscrow };
}

async function refundEscrowOrder(order: any, actorId: string, reason: string) {
  const escrow = await kv.get(`escrow:${order.escrowId}`);
  if (!escrow || escrow.status !== ESCROW_STATUS.PENDING) {
    throw new Error("Escrow is not refundable");
  }

  const amount = roundXafAmount(order.amount);
  // Full item amount refunded to buyer — platform fee already kept (non-refundable)
  // Seller gets NOTHING on refund since they did not complete delivery
  const sellerCompensation = 0;
  const buyerRefundAmount = amount;
  const now = new Date().toISOString();

  const escrowProviderSync = await syncEscrowProvider("refund", {
    escrowId: order.escrowId,
    orderId: order.id,
    amount,
    buyerRefundAmount,
    sellerCompensation,
    currency: "XAF",
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    actorId,
    reason: reason || "Buyer requested refund",
  });

  // Remove the item amount from seller's pending balance (they don't get paid)
  await adjustWallet(order.sellerId, { pendingDelta: -amount });
  // Credit buyer's wallet — they can request MoMo refund from their buyer dashboard
  await adjustWallet(order.buyerId, { availableDelta: buyerRefundAmount });

  // Auto-disburse refund to buyer's MoMo if payment provider is available
  const buyerProfile = await getUserProfile(order.buyerId);
  const buyerPhone = buyerProfile?.phone || order.phoneNumber || order.buyerPhoneNumber || "";
  if (isValidCameroonPhone(buyerPhone) && buyerRefundAmount > 0) {
    try {
      const refundRef = `REFUND-${order.id}-${Date.now()}`;
      await processOutboundMobileMoneyPayout({
        amount: buyerRefundAmount,
        phoneNumber: buyerPhone,
        provider: (order.paymentMethod === "orange-money" ? "orange-money" : "mtn-momo"),
        reference: refundRef,
        description: `Escrow refund for order ${order.id} — ${order.itemId}`,
      });
    } catch (refundPayoutError) {
      // Log but don't fail — buyer can manually withdraw from wallet
      console.error("Auto-refund payout failed:", refundPayoutError);
    }
  }

  const previousProviderSync =
    escrow?.provider_sync && typeof escrow.provider_sync === "object" && !Array.isArray(escrow.provider_sync)
      ? escrow.provider_sync
      : {};

  const updatedEscrow = {
    ...escrow,
    status: ESCROW_STATUS.REFUNDED,
    refunded_at: now,
    updated_at: now,
    refunded_by: actorId,
    refund_reason: reason || "Buyer requested refund",
    buyer_refund_amount: buyerRefundAmount,
    seller_compensation: sellerCompensation,
    provider_refund_status: escrowProviderSync.status,
    provider_refund_reference: escrowProviderSync.reference,
    provider_refund_synced: escrowProviderSync.synced,
    provider_refund_at: escrowProviderSync.syncedAt,
    provider_sync: {
      ...previousProviderSync,
      refund: escrowProviderSync,
      latest: escrowProviderSync,
      updatedAt: now,
    },
  };

  const updatedOrder = {
    ...order,
    status: ORDER_STATUS.REFUNDED,
    statusLabel: normalizeOrderStatusLabel(ORDER_STATUS.REFUNDED),
    refundedAt: now,
    refundReason: reason || "Buyer requested refund",
    buyerRefundAmount,
    sellerCompensation,
    escrowProviderStatus: escrowProviderSync.status,
    escrowProviderReference: escrowProviderSync.reference,
    escrowProviderSynced: escrowProviderSync.synced,
    escrowProviderUpdatedAt: escrowProviderSync.syncedAt,
    escrowRefundMeta: escrowProviderSync,
    updatedAt: now,
  };

  await kv.set(`escrow:${order.escrowId}`, updatedEscrow);
  await kv.set(`order:${order.id}`, updatedOrder);
  await kv.set(`transaction:${order.id}`, buildLegacyTransaction(updatedOrder));

  const listing = await kv.get(`listing:${order.itemId}`);
  if (listing && typeof listing === "object") {
    listing.status = "available";
    listing.reservedBy = "";
    listing.updatedAt = now;
    await kv.set(`listing:${order.itemId}`, listing);
  }

  const refundedTitle = listing?.title || "your order";
  await createUserNotification(updatedOrder.buyerId, {
    type: "refund_processed",
    title: "Refund processed",
    message: `Your refund for ${refundedTitle} has been processed. 90% was returned to your wallet.`,
    priority: "high",
    data: {
      orderId: updatedOrder.id,
      refundAmount: buyerRefundAmount,
      sellerCompensation,
    },
  });
  await createUserNotification(updatedOrder.sellerId, {
    type: "refund_compensation",
    title: "Order refunded",
    message: `Order ${updatedOrder.id} was refunded. Your 10% compensation was added to available balance.`,
    priority: "normal",
    data: {
      orderId: updatedOrder.id,
      compensationAmount: sellerCompensation,
      refundReason: updatedOrder.refundReason,
    },
  });

  return { order: updatedOrder, escrow: updatedEscrow };
}

// Public payment metadata for confirmation screens
app.get("/make-server-50b25a4f/payment-meta", async (c) => {
  const sampleAmount = 500;
  const sampleFee = calculateTransactionFee(sampleAmount);
  return c.json({
    merchant: {
      name: MERCHANT_MOMO_NAME,
      number: MERCHANT_MOMO_NUMBER,
    },
    transactionFee: {
      percent: TRANSACTION_FEE_PERCENT,
      flat: TRANSACTION_FEE_FLAT,
      sampleBaseAmount: sampleAmount,
      sampleFee,
      sampleTotal: roundXafAmount(sampleAmount + sampleFee),
    },
    paymentProvider: {
      provider: PAYMENT_PROVIDER_MODE,
      supportsFapshi: FAPSHI_COLLECTION_READY,
      supportsPush: true,
      supportsUssd: false,
      minAmount: FAPSHI_MIN_AMOUNT,
      // Diagnostic: true means payments are SIMULATED (no real charge / no prompt).
      // Caused by FAPSHI_FORCE_MOCK=true OR missing collection credentials.
      mockMode: shouldUseMockProvider(),
      forceMock: FAPSHI_FORCE_MOCK,
      collectionConfigured: FAPSHI_COLLECTION_READY,
    },
    escrowProvider: {
      enabled: ESCROW_PROVIDER_ENABLED,
      strictMode: ESCROW_API_STRICT,
      hasApiKey: Boolean(ESCROW_API_KEY),
      hasBaseUrl: Boolean(ESCROW_API_BASE_URL),
      paths: {
        hold: toApiPath(ESCROW_ACTION_ENDPOINTS.hold),
        release: toApiPath(ESCROW_ACTION_ENDPOINTS.release),
        refund: toApiPath(ESCROW_ACTION_ENDPOINTS.refund),
      },
    },
  });
});

// ── Public Platform Stats (used on Register page) ────────────────────────────
// Returns real counts from the database — no auth required.
app.get("/make-server-50b25a4f/public-stats", async (c) => {
  try {
    const [listings, users, orders] = await Promise.all([
      kv.getByPrefix("listing:"),
      kv.getByPrefix("user:"),
      kv.getByPrefix("order:"),
    ]);

    const activeListings = Array.isArray(listings)
      ? listings.filter((l: any) => String(l?.status || "").toLowerCase() === "available").length
      : 0;

    const totalStudents = Array.isArray(users)
      ? users.filter((u: any) => u?.id && !u?.role?.includes("admin")).length
      : 0;

    const completedDeals = Array.isArray(orders)
      ? orders.filter((o: any) => {
        const s = String(o?.status || "").toLowerCase();
        return s.includes("delivered") || s.includes("released") || s.includes("completed");
      }).length
      : 0;

    // Calculate average seller rating from user profiles
    const ratingsRaw = Array.isArray(users)
      ? users.map((u: any) => Number(u?.rating || 0)).filter((r: number) => r > 0)
      : [];
    const avgRating = ratingsRaw.length > 0
      ? (ratingsRaw.reduce((a: number, b: number) => a + b, 0) / ratingsRaw.length).toFixed(1)
      : "4.8";

    return c.json({
      students: totalStudents,
      listings: activeListings,
      deals: completedDeals,
      rating: avgRating,
    });
  } catch (_error) {
    // Return sensible fallbacks if DB is unavailable
    return c.json({ students: 0, listings: 0, deals: 0, rating: "4.8" });
  }
});

// ── Public top sellers (real completed-sales leaderboard for the home page) ───
app.get("/make-server-50b25a4f/top-sellers", async (c) => {
  try {
    const [orders, users] = await Promise.all([
      kv.getByPrefix("order:"),
      kv.getByPrefix("user:"),
    ]);

    const usersById = new Map<string, any>();
    for (const u of users || []) {
      if (u?.id) usersById.set(String(u.id), u);
    }

    // Count only orders whose escrow has been released / delivered — i.e. real sales.
    const statsBySeller = new Map<string, { sellerId: string; sales: number; amount: number }>();
    for (const order of orders || []) {
      if (!order?.sellerId) continue;
      const status = String(order?.status || "").toLowerCase();
      const isCompleted = status.includes("delivered") || status.includes("released") || status.includes("completed");
      if (!isCompleted) continue;
      const sellerId = String(order.sellerId);
      const current = statsBySeller.get(sellerId) || { sellerId, sales: 0, amount: 0 };
      current.sales += 1;
      current.amount += toSafeNumber(order?.sellerNetAmount ?? order?.amount, 0);
      statsBySeller.set(sellerId, current);
    }

    const sellers = Array.from(statsBySeller.values())
      .map((entry) => {
        const profile = usersById.get(entry.sellerId);
        if (!profile || profile.role === "admin" || profile.isBanned) return null;
        return {
          id: entry.sellerId,
          name: profile.name || "",
          university: profile.university || "",
          rating: toSafeNumber(profile.rating, 0),
          reviewCount: toSafeNumber(profile.reviewCount, 0),
          profilePicture: profile.profilePicture || "",
          isVerified: Boolean(profile.isVerified),
          sales: entry.sales,
          amount: entry.amount,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry && entry.name))
      .sort((a, b) => b.sales - a.sales || b.rating - a.rating || b.amount - a.amount)
      .slice(0, 8);

    return c.json({ sellers });
  } catch (error) {
    console.error("Get top sellers error:", error);
    return c.json({ sellers: [] });
  }
});

// ── NotchPay Mobile Money Push Payment ───────────────────────────────────────
// Sends a payment push request directly to the user's phone.
// On MTN MoMo / Orange Money the user gets a popup asking for their PIN only.
app.post("/make-server-50b25a4f/payment/notchpay/charge", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  if (!NOTCHPAY_PUBLIC_KEY || !NOTCHPAY_HASH_KEY) {
    return c.json({ error: "Payment provider not configured" }, 503);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const amount    = Math.round(Number(body?.amount || 0));
  const phone     = String(body?.phone || "").replace(/[^\d]/g, "");
  const method    = String(body?.paymentMethod || "mtn-momo");
  const itemTitle = normalizeAiText(body?.itemTitle, 120) || "Marketplace Purchase";
  const email     = String(body?.email || user.email || "buyer@unitrade.cm").trim();
  const reference = `UNIORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  if (amount < 100) return c.json({ error: "Amount too low" }, 400);
  if (phone.length < 9) return c.json({ error: "Invalid phone number" }, 400);

  // Normalise phone to international format (Cameroon +237)
  const internationalPhone = phone.startsWith("237") ? phone : `237${phone}`;

  // Map payment method to NotchPay channel
  const channel = method === "orange-money" ? "cm.orange" : "cm.mtn";

  const notchHeaders = {
    "Content-Type": "application/json",
    "Authorization": NOTCHPAY_PUBLIC_KEY,
    "X-Grant": NOTCHPAY_HASH_KEY,
  };

  try {
    // Step 1: Initialize the payment
    const initRes = await fetch(`${NOTCHPAY_API_URL}/payments`, {
      method: "POST",
      headers: notchHeaders,
      body: JSON.stringify({
        email,
        amount,
        currency: "XAF",
        description: itemTitle,
        reference,
        callback: "https://campus-market-yz1h.onrender.com/make-server-50b25a4f/payment/notchpay/callback",
      }),
    });

    const initData = await initRes.json().catch(() => ({}));
    if (!initRes.ok) {
      const msg = normalizeAiText(initData?.message || initData?.error, 200) || "Payment initialization failed";
      return c.json({ error: msg }, 400);
    }

    const txRef = initData?.transaction?.reference || reference;

    // Step 2: Charge — sends the push payment request to the user's phone
    const chargeRes = await fetch(`${NOTCHPAY_API_URL}/payments/${encodeURIComponent(txRef)}/charge`, {
      method: "POST",
      headers: notchHeaders,
      body: JSON.stringify({ channel, data: { phone: internationalPhone } }),
    });

    const chargeData = await chargeRes.json().catch(() => ({}));
    if (!chargeRes.ok) {
      const msg = normalizeAiText(chargeData?.message || chargeData?.error, 200) || "Failed to send payment request to phone";
      return c.json({ error: msg }, 400);
    }

    return c.json({
      success: true,
      reference: txRef,
      status: chargeData?.transaction?.status || "pending",
      message: "Payment request sent to your phone. Enter your PIN to confirm.",
    });
  } catch (error) {
    console.error("NotchPay charge error:", error);
    return c.json({ error: "Could not reach payment provider. Try again." }, 500);
  }
});

// NotchPay webhook callback
app.post("/make-server-50b25a4f/payment/notchpay/callback", async (c) => {
  // Payment status update from NotchPay — log and acknowledge
  const body = await c.req.json().catch(() => ({}));
  console.log("NotchPay callback:", JSON.stringify(body).slice(0, 500));
  return c.json({ received: true });
});

// Public pickup points for campus/public meetup flow
app.get("/make-server-50b25a4f/pickup-locations", async (c) => {
  return c.json({ locations: ALLOWED_PICKUP_LOCATIONS });
});

// Activate subscription with mobile money payment
app.post("/make-server-50b25a4f/subscription/update", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getUserProfile(user.id);
    if (!profile || profile.role === "admin") {
      return c.json({ error: "Subscription update is available for student accounts only" }, 403);
    }

    const body = await c.req.json();
    const plan = body?.plan === "yearly" ? "yearly" : "monthly";
    const paymentMethod = body?.paymentMethod === "orange-money" ? "orange-money" : "mtn-momo";
    const phoneNumber = normalizePhone(body?.phoneNumber || profile.phone || "");

    if (!isValidCameroonPhone(phoneNumber)) {
      return c.json({ error: "A valid Cameroon phone number is required" }, 400);
    }

    const userType = profile.userType === "seller" ? "seller" : "buyer";
    const baseAmount = roundXafAmount(SUBSCRIPTION_PLAN_PRICING[userType][plan]);
    const transactionFee = userType === "buyer" && plan === "monthly"
      ? 0
      : calculateTransactionFee(baseAmount);
    const totalCharged = roundXafAmount(baseAmount + transactionFee);
    const reference = `SUB-${paymentMethod.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // All subscription payments go through Fapshi hosted checkout. Manual USSD removed.
    const appOrigin = typeof body?.appOrigin === "string" ? body.appOrigin.replace(/\/+$/, "") : "";
    const paymentResult = await processInboundMobileMoneyPayment({
      amount: totalCharged,
      phoneNumber,
      provider: paymentMethod,
      reference,
      description: `${plan} ${userType} subscription`,
      buyerName: profile.name,
      buyerEmail: profile.email,
      userId: user.id,
      redirectUrl: appOrigin ? `${appOrigin}/dashboard` : undefined,
    });
    // Fapshi confirms asynchronously; only mock returns "successful" now.
    const paymentConfirmed = paymentResult.status === "successful";
    const paymentLink = (paymentResult as any).paymentLink || "";
    const nowIso = new Date().toISOString();

    // Record the subscription payment as pending; activation (and crediting the
    // platform wallet) happens only once payment is confirmed.
    const paymentId = createEntityId("SUBPAY");
    const paymentRecord = {
      id: paymentId,
      userId: user.id,
      plan,
      userType,
      amount: baseAmount,
      transactionFee,
      totalCharged,
      paymentMethod,
      phoneNumber,
      merchantName: MERCHANT_MOMO_NAME,
      merchantNumber: MERCHANT_MOMO_NUMBER,
      provider: paymentResult.provider,
      providerStatus: paymentResult.status,
      providerReference: paymentResult.reference || reference,
      providerPayload: paymentResult.raw,
      status: "pending",
      createdAt: nowIso,
    };
    await kv.set(`subscription_payment:${paymentId}`, paymentRecord);
    await kv.set(`transaction:${paymentId}`, buildSubscriptionTransaction(paymentRecord));
    const paymentIds = (await kv.get(`user:${user.id}:subscriptionPayments`)) || [];
    paymentIds.push(paymentId);
    await kv.set(`user:${user.id}:subscriptionPayments`, paymentIds);

    // Index the Fapshi transaction so the webhook can activate the subscription.
    if (paymentResult.provider === "fapshi" && paymentResult.reference) {
      await kv.set(`fapshi:tx:${paymentResult.reference}`, {
        type: "subscription",
        paymentId,
        userId: user.id,
        createdAt: nowIso,
      });
    }

    if (!paymentConfirmed) {
      await recordPaymentAudit("subscription_pending", { paymentId, userId: user.id });
      return c.json({
        success: true,
        pending: true,
        paymentLink,
        message: "Continue to Fapshi to complete your subscription payment.",
        payment: paymentRecord,
      });
    }

    // Mock/synchronous success — activate immediately via the shared path.
    const activated = await activateSubscriptionFromPayment(paymentId);
    return c.json({
      success: true,
      message: "Subscription activated successfully",
      user: activated?.user || profile,
      payment: activated?.payment || paymentRecord,
    });
  } catch (error: any) {
    console.error("Subscription update error:", error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to update subscription" }, 500);
  }
});

// Create order with escrow payment
app.post("/make-server-50b25a4f/orders", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getUserProfile(user.id);
    if (!profile || profile.role === "admin") {
      return c.json({ error: "Only buyers can place orders" }, 403);
    }

    const body = await c.req.json();
    const { order, escrowTransaction } = await createEscrowOrderForBuyer(user, body);
    return c.json({ success: true, order, escrowTransaction, transaction: buildLegacyTransaction(order) });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    const statusCode = /required|valid|cannot|available|not found|location/i.test(message) ? 400 : 500;
    return c.json({ error: message }, statusCode);
  }
});

// Get current user's orders
app.get("/make-server-50b25a4f/orders", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getUserProfile(user.id);
    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const allOrders = (await kv.getByPrefix("order:")) || [];
    const filteredOrders = profile.role === "admin"
      ? allOrders
      : allOrders.filter((order: any) => order?.buyerId === user.id || order?.sellerId === user.id);

    const orders = await Promise.all(
      filteredOrders.map(async (order: any) => {
        const escrow = await kv.get(`escrow:${order.escrowId}`);
        const listing = await kv.get(`listing:${order.itemId}`);
        const seller = order?.sellerId ? await getUserProfile(order.sellerId) : null;

        const listingType = listing?.type === "rent" ? "rent" : "sell";
        const rentalPeriod = listingType === "rent" ? (listing?.rentalPeriod || "monthly") : null;
        const rentalStartSource = order?.pickupDate || order?.createdAt;
        const rentalStart = rentalStartSource ? new Date(rentalStartSource) : null;
        const rentalEnd = rentalStart ? new Date(rentalStart.getTime()) : null;
        if (rentalEnd && rentalPeriod === "daily") {
          rentalEnd.setDate(rentalEnd.getDate() + 1);
        } else if (rentalEnd && rentalPeriod === "weekly") {
          rentalEnd.setDate(rentalEnd.getDate() + 7);
        } else if (rentalEnd && rentalPeriod === "monthly") {
          rentalEnd.setMonth(rentalEnd.getMonth() + 1);
        }

        return {
          ...order,
          statusLabel: normalizeOrderStatusLabel(order.status),
          escrowStatus: escrow?.status || ESCROW_STATUS.PENDING,
          proofImageUrl: order.deliveryProofUrl || escrow?.proof_image_url || "",
          listingTitle: listing?.title || "Unknown Item",
          listingImage: listing?.images?.[0] || "",
          listingType,
          rentalPeriod,
          rentalStartDate: rentalStart ? rentalStart.toISOString() : null,
          rentalEndDate: rentalEnd ? rentalEnd.toISOString() : null,
          sellerName: seller?.name || "",
        };
      }),
    );

    orders.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return c.json({ orders });
  } catch (error) {
    console.error("Get orders error:", error);
    return c.json({ error: "Failed to get orders" }, 500);
  }
});

// Safety net for missed/delayed webhooks: if an order is still AWAITING_PAYMENT,
// re-verify its status directly with Fapshi and confirm/void it. This makes the
// buyer's status poll self-healing so payments never get stuck if the webhook
// fails to arrive. Defensive: never throws, returns the freshest order record.
async function reconcileAwaitingOrder(order: any) {
  if (!order || order.status !== ORDER_STATUS.AWAITING_PAYMENT) return order;
  if (order.paymentProvider !== "fapshi" || !order.paymentProviderReference) return order;
  try {
    const statusData = await getFapshiPaymentStatus(order.paymentProviderReference, "collection");
    const status = normalizeFapshiStatus(statusData?.status);
    if (status === "successful") {
      const result = await confirmEscrowOrderPaid(order.id);
      return result?.order || (await kv.get(`order:${order.id}`)) || order;
    }
    if (status === "failed" || status === "expired") {
      await voidAwaitingEscrowOrder(order.id, `Fapshi payment ${status}`, status);
      return (await kv.get(`order:${order.id}`)) || order;
    }
  } catch (error) {
    // Status check failed (transient/network) — leave the order as-is.
    console.error("reconcileAwaitingOrder failed:", error);
  }
  return order;
}

// Get single order details
app.get("/make-server-50b25a4f/orders/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orderId = c.req.param("id");
    let order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    const profile = await getUserProfile(user.id);
    const isAdmin = profile?.role === "admin";
    const isBuyer = order.buyerId === user.id;
    const isSeller = order.sellerId === user.id;
    if (!isAdmin && !isBuyer && !isSeller) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Self-heal a stuck payment if the webhook was missed/delayed.
    order = await reconcileAwaitingOrder(order);

    const existingEscrow = await kv.get(`escrow:${order.escrowId}`);
    const listing = await kv.get(`listing:${order.itemId}`);
    const seller = await getUserProfile(order.sellerId);
    const buyer = await getUserProfile(order.buyerId);
    const sellerWallet = await getWallet(order.sellerId);
    const hasSellerProof = Boolean(order.sellerProofUploaded || order.deliveryProofUrl || existingEscrow?.proof_image_url);
    const resolvedProofUrl = order.deliveryProofUrl || existingEscrow?.proof_image_url || "";

    return c.json({
      order: {
        ...order,
        sellerProofUploaded: hasSellerProof,
        deliveryProofUrl: resolvedProofUrl,
        statusLabel: normalizeOrderStatusLabel(order.status),
      },
      escrow: existingEscrow,
      listing,
      seller,
      buyer,
      sellerWallet: {
        pendingBalance: sellerWallet.pendingBalance,
        availableBalance: sellerWallet.availableBalance,
      },
      permissions: {
        isBuyer,
        isSeller,
        isAdmin,
        canSellerUploadProof: isSeller && order.status === ORDER_STATUS.PAID_PENDING_DELIVERY,
        canBuyerConfirm:
          isBuyer &&
          order.status === ORDER_STATUS.PAID_PENDING_DELIVERY,
        canBuyerRefund: isBuyer && order.status === ORDER_STATUS.PAID_PENDING_DELIVERY,
      },
    });
  } catch (error) {
    console.error("Get order details error:", error);
    return c.json({ error: "Failed to get order details" }, 500);
  }
});

// Seller uploads proof and marks delivered
app.put("/make-server-50b25a4f/orders/:id/seller-proof", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orderId = c.req.param("id");
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.sellerId !== user.id) {
      return c.json({ error: "Only the seller can upload delivery proof" }, 403);
    }
    if (order.status !== ORDER_STATUS.PAID_PENDING_DELIVERY) {
      return c.json({ error: "Delivery proof can only be uploaded for pending orders" }, 400);
    }

    const body = await c.req.json();
    const proofImageUrl = typeof body?.proofImageUrl === "string" ? body.proofImageUrl.trim() : "";
    if (!proofImageUrl) {
      return c.json({ error: "Proof image URL is required" }, 400);
    }

    const now = new Date().toISOString();
    const updatedOrder = {
      ...order,
      sellerProofUploaded: true,
      deliveryProofUrl: proofImageUrl,
      sellerDeliveredAt: now,
      updatedAt: now,
    };
    await kv.set(`order:${orderId}`, updatedOrder);

    const existingEscrow = await kv.get(`escrow:${order.escrowId}`);
    if (existingEscrow) {
      await kv.set(`escrow:${order.escrowId}`, {
        ...existingEscrow,
        proof_image_url: proofImageUrl,
        updated_at: now,
      });
    }

    const listing = await kv.get(`listing:${order.itemId}`);
    await createUserNotification(order.buyerId, {
      type: "delivery_proof_uploaded",
      title: "Seller marked order delivered",
      message: `Delivery proof was uploaded for ${listing?.title || "your order"}. Confirm receipt to release payment.`,
      priority: "high",
      data: {
        orderId,
        itemId: order.itemId,
        proofImageUrl,
      },
    });

    return c.json({
      success: true,
      order: {
        ...updatedOrder,
        statusLabel: normalizeOrderStatusLabel(updatedOrder.status),
      },
    });
  } catch (error) {
    console.error("Seller proof upload error:", error);
    return c.json({ error: "Failed to upload delivery proof" }, 500);
  }
});

// Seller accepts or rejects an order
app.put("/make-server-50b25a4f/orders/:id/seller-decision", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orderId = c.req.param("id");
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.sellerId !== user.id) {
      return c.json({ error: "Only the seller can decide on this order" }, 403);
    }
    if (order.status !== ORDER_STATUS.PAID_PENDING_DELIVERY) {
      return c.json({ error: "Order is not awaiting seller action" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const decision = body?.decision === "rejected" ? "rejected" : "accepted";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (decision === "rejected") {
      const { order: refundedOrder, escrow } = await refundEscrowOrder(order, user.id, reason || "Seller rejected order");
      await createUserNotification(order.buyerId, {
        type: "order_rejected",
        title: "Order rejected by seller",
        message: `Seller rejected order ${orderId}. Refund has been initiated.`,
        priority: "high",
        data: {
          orderId,
          reason: reason || "Seller rejected order",
        },
      });

      return c.json({
        success: true,
        order: { ...refundedOrder, statusLabel: normalizeOrderStatusLabel(refundedOrder.status) },
        escrow,
      });
    }

    const now = new Date().toISOString();
    const updatedOrder = {
      ...order,
      sellerDecision: "accepted",
      sellerAcceptedAt: now,
      sellerDecisionReason: reason,
      updatedAt: now,
    };
    await kv.set(`order:${orderId}`, updatedOrder);
    await kv.set(`transaction:${orderId}`, buildLegacyTransaction(updatedOrder));

    await createUserNotification(order.buyerId, {
      type: "order_accepted",
      title: "Order accepted by seller",
      message: `Seller accepted order ${orderId}. Awaiting delivery confirmation.`,
      priority: "normal",
      data: {
        orderId,
      },
    });

    return c.json({
      success: true,
      order: { ...updatedOrder, statusLabel: normalizeOrderStatusLabel(updatedOrder.status) },
    });
  } catch (error) {
    console.error("Seller decision error:", error);
    return c.json({ error: "Failed to process seller decision" }, 500);
  }
});

// Seller marks rental as returned/ended
app.put("/make-server-50b25a4f/orders/:id/seller-returned", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orderId = c.req.param("id");
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.sellerId !== user.id) {
      return c.json({ error: "Only the seller can mark this rental as returned" }, 403);
    }

    const listing = await kv.get(`listing:${order.itemId}`);
    const isRentalOrder = listing?.type === "rent" || Boolean(order?.rentalPeriod);
    if (!isRentalOrder) {
      return c.json({ error: "This order is not a rental transaction" }, 400);
    }

    const now = new Date().toISOString();
    const updatedOrder = {
      ...order,
      rentalReturnStatus: "ended",
      sellerMarkedReturnedAt: now,
      updatedAt: now,
    };

    await kv.set(`order:${orderId}`, updatedOrder);
    await kv.set(`transaction:${orderId}`, buildLegacyTransaction(updatedOrder));

    if (listing && typeof listing === "object") {
      listing.status = "available";
      listing.updatedAt = now;
      listing.reservedBy = "";
      await kv.set(`listing:${order.itemId}`, listing);
    }

    await createUserNotification(order.buyerId, {
      type: "rental_returned",
      title: "Rental marked returned",
      message: `Seller marked rental order ${orderId} as returned.`,
      priority: "normal",
      data: {
        orderId,
        itemId: order.itemId,
      },
    });

    return c.json({
      success: true,
      order: { ...updatedOrder, statusLabel: normalizeOrderStatusLabel(updatedOrder.status) },
    });
  } catch (error) {
    console.error("Seller return mark error:", error);
    return c.json({ error: "Failed to mark rental as returned" }, 500);
  }
});

// Buyer confirms delivery and satisfaction to release escrow
app.put("/make-server-50b25a4f/orders/:id/buyer-confirm", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orderId = c.req.param("id");
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    const existingEscrow = await kv.get(`escrow:${order.escrowId}`);
    if (order.buyerId !== user.id) {
      return c.json({ error: "Only the buyer can confirm delivery" }, 403);
    }
    if (order.status !== ORDER_STATUS.PAID_PENDING_DELIVERY) {
      return c.json({ error: "Order is not awaiting confirmation" }, 400);
    }
    const hasSellerProof = Boolean(order.sellerProofUploaded || order.deliveryProofUrl || existingEscrow?.proof_image_url);

    const body = await c.req.json();
    const satisfactionConfirmed = Boolean(body?.satisfactionConfirmed);
    const receivedConfirmed = Boolean(body?.receivedConfirmed);
    const issueReason = typeof body?.issueReason === "string" ? body.issueReason.trim() : "";

    if (!receivedConfirmed) {
      return c.json({ error: "You must confirm receipt before proceeding" }, 400);
    }

    if (!satisfactionConfirmed) {
      const { order: refundedOrder, escrow } = await refundEscrowOrder(order, user.id, issueReason || "Buyer not satisfied");
      return c.json({
        success: true,
        order: { ...refundedOrder, statusLabel: normalizeOrderStatusLabel(refundedOrder.status) },
        escrow,
      });
    }

    const now = new Date().toISOString();
    const confirmedOrder = {
      ...order,
      sellerProofUploaded: hasSellerProof,
      deliveryProofUrl: order.deliveryProofUrl || existingEscrow?.proof_image_url || "",
      buyerSatisfied: true,
      buyerConfirmedAt: now,
      updatedAt: now,
    };
    await kv.set(`order:${orderId}`, confirmedOrder);

    const { order: releasedOrder, escrow } = await releaseEscrowOrder(confirmedOrder, user.id);

    return c.json({
      success: true,
      order: { ...releasedOrder, statusLabel: normalizeOrderStatusLabel(releasedOrder.status) },
      escrow,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to confirm delivery";
    return c.json({ error: message }, 500);
  }
});

// Buyer reports issue and requests refund
app.post("/make-server-50b25a4f/orders/:id/refund", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orderId = c.req.param("id");
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.buyerId !== user.id) {
      return c.json({ error: "Only the buyer can request a refund" }, 403);
    }
    if (order.status !== ORDER_STATUS.PAID_PENDING_DELIVERY) {
      return c.json({ error: "Refund is only available for pending escrow orders" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "Buyer requested refund";
    const { order: refundedOrder, escrow } = await refundEscrowOrder(order, user.id, reason);

    return c.json({
      success: true,
      order: { ...refundedOrder, statusLabel: normalizeOrderStatusLabel(refundedOrder.status) },
      escrow,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to process refund";
    return c.json({ error: message }, 500);
  }
});

// Get current wallet
app.get("/make-server-50b25a4f/wallet", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const wallet = await getWallet(user.id);
    const withdrawalIds = (await kv.get(`user:${user.id}:withdrawals`)) || [];
    const withdrawals = await Promise.all(withdrawalIds.map(async (id: string) => await kv.get(`withdrawal:${id}`)));
    return c.json({
      wallet,
      withdrawals: withdrawals.filter((withdrawal: any) => withdrawal),
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    return c.json({ error: "Failed to load wallet" }, 500);
  }
});

// Get withdrawals (user or admin)
app.get("/make-server-50b25a4f/wallet/withdrawals", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getUserProfile(user.id);
    const allWithdrawals = (await kv.getByPrefix("withdrawal:")) || [];
    const withdrawals = profile?.role === "admin"
      ? allWithdrawals
      : allWithdrawals.filter((withdrawal: any) => withdrawal?.userId === user.id);
    withdrawals.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return c.json({ withdrawals });
  } catch (error) {
    console.error("Get withdrawals error:", error);
    return c.json({ error: "Failed to get withdrawals" }, 500);
  }
});

// Request withdrawal from available wallet balance
app.post("/make-server-50b25a4f/wallet/withdrawals", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const amount = roundXafAmount(body?.amount);
    const provider = body?.provider === "orange-money" ? "orange-money" : "mtn-momo";
    const phoneNumber = normalizePhone(body?.phoneNumber);

    if (!amount || amount <= 0) {
      return c.json({ error: "Withdrawal amount must be greater than zero" }, 400);
    }
    if (!isValidCameroonPhone(phoneNumber)) {
      return c.json({ error: "A valid Cameroon phone number is required" }, 400);
    }

    const wallet = await getWallet(user.id);
    if (wallet.availableBalance < amount) {
      return c.json({ error: "Insufficient available balance" }, 400);
    }

    const now = new Date().toISOString();
    const withdrawalId = createEntityId("WD");
    const payoutReference = `${provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payoutResult = await processOutboundMobileMoneyPayout({
      amount,
      phoneNumber,
      provider,
      reference: payoutReference,
      description: `Seller wallet withdrawal for user ${user.id}`,
    });
    const payoutStatus = String(payoutResult.status || "").toLowerCase();
    const completedStatuses = new Set(["successful", "success", "completed"]);
    const withdrawalStatus = completedStatuses.has(payoutStatus)
      ? WITHDRAWAL_STATUS.COMPLETED
      : WITHDRAWAL_STATUS.PROCESSING;

    await adjustWallet(user.id, { availableDelta: -amount });

    const withdrawal = {
      id: withdrawalId,
      userId: user.id,
      amount,
      provider,
      phoneNumber,
      status: withdrawalStatus,
      reference: payoutResult.reference || payoutReference,
      providerStatus: payoutResult.status,
      providerName: payoutResult.provider,
      providerPayload: payoutResult.raw,
      note:
        withdrawalStatus === WITHDRAWAL_STATUS.COMPLETED
          ? "Payout to mobile money"
          : "Payout accepted and processing with provider",
      createdAt: now,
      updatedAt: now,
      processedBy: "system",
    };

    await kv.set(`withdrawal:${withdrawalId}`, withdrawal);
    await indexFapshiPayout(payoutResult, withdrawalId);
    const withdrawals = (await kv.get(`user:${user.id}:withdrawals`)) || [];
    withdrawals.push(withdrawalId);
    await kv.set(`user:${user.id}:withdrawals`, withdrawals);

    return c.json({ success: true, withdrawal, wallet: await getWallet(user.id) });
  } catch (error) {
    console.error("Create withdrawal error:", error);
    const message = error instanceof Error ? error.message : "Failed to process withdrawal";
    return c.json({ error: message }, 500);
  }
});

// Backward-compatible transaction endpoint (escrow-backed)
app.post("/make-server-50b25a4f/transactions", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { order } = await createEscrowOrderForBuyer(user, body);
    return c.json({ success: true, transaction: buildLegacyTransaction(order), order });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to create transaction";
    const statusCode = /required|valid|cannot|available|not found|location/i.test(message) ? 400 : 500;
    return c.json({ error: message }, statusCode);
  }
});

// Backward-compatible transaction list endpoint (escrow-backed)
app.get("/make-server-50b25a4f/transactions", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getUserProfile(user.id);
    const allOrders = (await kv.getByPrefix("order:")) || [];
    const scopedOrders = profile?.role === "admin"
      ? allOrders
      : allOrders.filter((order: any) => order?.buyerId === user.id || order?.sellerId === user.id);
    const transactionsFromOrders = scopedOrders.map((order: any) => buildLegacyTransaction(order));

    const legacyTxnIds = (await kv.get(`user:${user.id}:transactions`)) || [];
    const legacyTransactions = await Promise.all(
      legacyTxnIds.map(async (id: string) => await kv.get(`transaction:${id}`)),
    );
    const normalizedLegacy = (legacyTransactions || []).filter((txn: any) => txn && !txn.orderId);

    return c.json({ transactions: [...transactionsFromOrders, ...normalizedLegacy] });
  } catch (error) {
    console.error("Get transactions error:", error);
    return c.json({ error: "Failed to get transactions" }, 500);
  }
});

// ============ NOTIFICATIONS ROUTES ============

app.get("/make-server-50b25a4f/notifications", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const notificationIds = (await kv.get(`user:${user.id}:notifications`)) || [];
    const notifications = (await Promise.all(
      notificationIds.map(async (id: string) => await kv.get(`notification:${id}`)),
    ))
      .filter((notification: any) => notification && notification.userId === user.id)
      .sort(sortByCreatedDesc);

    const unreadCount = notifications.filter((notification: any) => !notification.read).length;
    return c.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    return c.json({ error: "Failed to get notifications" }, 500);
  }
});

app.put("/make-server-50b25a4f/notifications/read-all", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const notificationIds = (await kv.get(`user:${user.id}:notifications`)) || [];
    const now = new Date().toISOString();

    await Promise.all(notificationIds.map(async (id: string) => {
      const notification = await kv.get(`notification:${id}`);
      if (!notification || notification.userId !== user.id || notification.read) return;
      await kv.set(`notification:${id}`, {
        ...notification,
        read: true,
        readAt: now,
        updatedAt: now,
      });
    }));

    return c.json({ success: true });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return c.json({ error: "Failed to update notifications" }, 500);
  }
});

app.put("/make-server-50b25a4f/notifications/:id/read", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    const notification = await kv.get(`notification:${id}`);
    if (!notification || notification.userId !== user.id) {
      return c.json({ error: "Notification not found" }, 404);
    }

    const now = new Date().toISOString();
    const updatedNotification = {
      ...notification,
      read: true,
      readAt: now,
      updatedAt: now,
    };
    await kv.set(`notification:${id}`, updatedNotification);
    return c.json({ success: true, notification: updatedNotification });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return c.json({ error: "Failed to update notification" }, 500);
  }
});

// ============ REPORTS ROUTES ============

app.post("/make-server-50b25a4f/reports", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getUserProfile(user.id);
    if (!profile || profile.role === "admin") {
      return c.json({ error: "Only buyer and seller accounts can submit reports" }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const category = typeof body?.category === "string" ? body.category.trim() : "general";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";

    if (!description || description.length < 10) {
      return c.json({ error: "Please provide at least 10 characters in the report details" }, 400);
    }

    const reportId = createEntityId("RPT");
    const now = new Date().toISOString();
    const report = {
      id: reportId,
      reporterId: user.id,
      reporterRole: profile.userType || "buyer",
      targetUserId,
      orderId,
      listingId,
      category,
      description,
      status: REPORT_STATUS.OPEN,
      adminNote: "",
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(`report:${reportId}`, report);
    const userReports = (await kv.get(`user:${user.id}:reports`)) || [];
    userReports.unshift(reportId);
    await kv.set(`user:${user.id}:reports`, userReports);

    await notifyAdmins({
      type: "new_report",
      title: "New user report submitted",
      message: `${profile.name || "A user"} submitted a ${category} report.`,
      priority: "high",
      data: {
        reportId,
        reporterId: user.id,
        reporterName: profile.name || "",
      },
    });

    return c.json({ success: true, report });
  } catch (error) {
    console.error("Create report error:", error);
    return c.json({ error: "Failed to submit report" }, 500);
  }
});

app.get("/make-server-50b25a4f/reports", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getUserProfile(user.id);
    const allReports = (await kv.getByPrefix("report:")) || [];

    const scopedReports = profile?.role === "admin"
      ? allReports
      : allReports.filter((report: any) =>
        report?.reporterId === user.id || report?.targetUserId === user.id
      );

    const reports = (await Promise.all(
      scopedReports.map(async (report: any) => {
        const [reporter, target] = await Promise.all([
          report?.reporterId ? getUserProfile(report.reporterId) : Promise.resolve(null),
          report?.targetUserId ? getUserProfile(report.targetUserId) : Promise.resolve(null),
        ]);
        return {
          ...report,
          reporterName: reporter?.name || "Unknown User",
          targetUserName: target?.name || "",
        };
      }),
    )).sort(sortByCreatedDesc);

    return c.json({ reports });
  } catch (error) {
    console.error("Get reports error:", error);
    return c.json({ error: "Failed to get reports" }, 500);
  }
});

app.get("/make-server-50b25a4f/admin/reports", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const allReports = (await kv.getByPrefix("report:")) || [];
    const reports = (await Promise.all(
      allReports.map(async (report: any) => {
        const [reporter, target] = await Promise.all([
          report?.reporterId ? getUserProfile(report.reporterId) : Promise.resolve(null),
          report?.targetUserId ? getUserProfile(report.targetUserId) : Promise.resolve(null),
        ]);
        return {
          ...report,
          reporterName: reporter?.name || "Unknown User",
          targetUserName: target?.name || "",
        };
      }),
    )).sort(sortByCreatedDesc);
    return c.json({ reports });
  } catch (error) {
    console.error("Get admin reports error:", error);
    return c.json({ error: "Failed to get reports" }, 500);
  }
});

app.put("/make-server-50b25a4f/admin/reports/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const reportId = c.req.param("id");
    const report = await kv.get(`report:${reportId}`);
    if (!report) {
      return c.json({ error: "Report not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const nextStatus = [REPORT_STATUS.OPEN, REPORT_STATUS.REVIEWED, REPORT_STATUS.RESOLVED, REPORT_STATUS.REJECTED]
      .includes(body?.status)
      ? body.status
      : report.status;
    const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim() : report.adminNote;
    const now = new Date().toISOString();

    const updatedReport = {
      ...report,
      status: nextStatus,
      adminNote,
      updatedAt: now,
      reviewedBy: user.id,
    };
    await kv.set(`report:${reportId}`, updatedReport);

    if (report.reporterId) {
      await createUserNotification(report.reporterId, {
        type: "report_updated",
        title: "Report status updated",
        message: `Your report is now marked as ${nextStatus}.`,
        priority: "normal",
        data: {
          reportId,
          status: nextStatus,
          adminNote,
        },
      });
    }

    return c.json({ success: true, report: updatedReport });
  } catch (error) {
    console.error("Update report error:", error);
    return c.json({ error: "Failed to update report" }, 500);
  }
});

// ============ FAVORITES ROUTES ============

// Add to favorites
app.post("/make-server-50b25a4f/favorites", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { itemId } = body;

    const listing = await kv.get(`listing:${itemId}`);
    
    if (!listing) {
      return c.json({ error: 'Listing not found' }, 404);
    }

    const favorites = await kv.get(`user:${user.id}:favorites`) || [];
    
    if (!favorites.includes(itemId)) {
      favorites.push(itemId);
      await kv.set(`user:${user.id}:favorites`, favorites);
      listing.likesCount = Math.max(0, toSafeNumber(listing.likesCount, 0)) + 1;
      await kv.set(`listing:${itemId}`, listing);
    }

    return c.json({
      success: true,
      likesCount: Math.max(0, toSafeNumber(listing.likesCount, 0)),
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    return c.json({ error: 'Failed to add to favorites' }, 500);
  }
});

// Remove from favorites
app.delete("/make-server-50b25a4f/favorites/:itemId", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const itemId = c.req.param('itemId');
    const favorites = await kv.get(`user:${user.id}:favorites`) || [];
    const hadFavorite = favorites.includes(itemId);
    const listing = await kv.get(`listing:${itemId}`);

    const newFavorites = favorites.filter((id: string) => id !== itemId);
    await kv.set(`user:${user.id}:favorites`, newFavorites);

    if (hadFavorite && listing) {
      listing.likesCount = Math.max(0, toSafeNumber(listing.likesCount, 0) - 1);
      await kv.set(`listing:${itemId}`, listing);
    }

    return c.json({
      success: true,
      likesCount: listing ? Math.max(0, toSafeNumber(listing.likesCount, 0)) : 0,
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    return c.json({ error: 'Failed to remove from favorites' }, 500);
  }
});

// Get user's favorites
app.get("/make-server-50b25a4f/favorites", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const favoriteIds = await kv.get(`user:${user.id}:favorites`) || [];
    const favorites = await Promise.all(
      favoriteIds.map(async (id: string) => await kv.get(`listing:${id}`))
    );

    return c.json({ favorites: favorites.filter(Boolean) });
  } catch (error) {
    console.error('Get favorites error:', error);
    return c.json({ error: 'Failed to get favorites' }, 500);
  }
});

// ============ REVIEWS ROUTES ============

// Create review
app.post("/make-server-50b25a4f/reviews", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { transactionId, sellerId, rating, comment } = body;

    // Check if review already exists
    const existingReviews = await kv.getByPrefix(`review:txn-${transactionId}`);
    if (existingReviews.length > 0) {
      return c.json({ error: 'You have already reviewed this transaction' }, 400);
    }

    const reviewId = `review:txn-${transactionId}-${Date.now()}`;
    
    const review = {
      id: reviewId,
      transactionId,
      reviewerId: user.id,
      sellerId,
      rating: parseFloat(rating),
      comment,
      timestamp: new Date().toISOString(),
    };

    await kv.set(reviewId, review);

    // Update seller's rating
    const sellerProfile = await getUserProfile(sellerId);
    if (sellerProfile) {
      const currentTotal = sellerProfile.rating * sellerProfile.reviewCount;
      sellerProfile.reviewCount += 1;
      sellerProfile.rating = (currentTotal + review.rating) / sellerProfile.reviewCount;
      await kv.set(`user:${sellerId}`, sellerProfile);
    }

    return c.json({ success: true, review });
  } catch (error) {
    console.error('Create review error:', error);
    return c.json({ error: 'Failed to create review' }, 500);
  }
});

// Get reviews for a user
app.get("/make-server-50b25a4f/reviews/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const allReviews = await kv.getByPrefix('review:');
    const userReviews = allReviews.filter((r: any) => r.sellerId === userId);

    return c.json({ reviews: userReviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    return c.json({ error: 'Failed to get reviews' }, 500);
  }
});

async function recalculateSellerRating(sellerId: string) {
  if (!sellerId) return;
  const seller = await getUserProfile(sellerId);
  if (!seller) return;

  const allReviews = (await kv.getByPrefix("review:")) || [];
  const sellerReviews = allReviews.filter((review: any) => review?.sellerId === sellerId);
  const reviewCount = sellerReviews.length;
  const total = sellerReviews.reduce((sum: number, review: any) => sum + toSafeNumber(review?.rating, 0), 0);
  const rating = reviewCount > 0 ? roundMoney(total / reviewCount) : 0;

  const updated = {
    ...seller,
    reviewCount,
    rating,
  };
  await kv.set(`user:${sellerId}`, updated);
}

// ============ ADMIN ROUTES ============

// Get pending users (admin only)
app.get("/make-server-50b25a4f/admin/pending-users", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getUserProfile(user.id);
  
  if (profile.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin only' }, 403);
  }

  try {
    const allUsers = await kv.getByPrefix('user:');
    const pendingUsers = allUsers.filter((u: any) => 
      u.role === 'student' && !u.isApproved
    );

    return c.json({ users: pendingUsers });
  } catch (error) {
    console.error('Get pending users error:', error);
    return c.json({ error: 'Failed to get pending users' }, 500);
  }
});

// Approve user (admin only)
app.post("/make-server-50b25a4f/admin/approve-user/:userId", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getUserProfile(user.id);
  
  if (profile.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin only' }, 403);
  }

  try {
    const userId = c.req.param('userId');
    const targetUser = await getUserProfile(userId);
    
    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    targetUser.isApproved = true;
    targetUser.isVerified = true;
    await kv.set(`user:${userId}`, targetUser);

    // TODO: Send email notification
    console.log(`User ${targetUser.email} has been approved`);

    return c.json({ success: true, message: 'User approved successfully' });
  } catch (error) {
    console.error('Approve user error:', error);
    return c.json({ error: 'Failed to approve user' }, 500);
  }
});

// Deny user (admin only)
app.post("/make-server-50b25a4f/admin/deny-user/:userId", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getUserProfile(user.id);
  
  if (profile.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin only' }, 403);
  }

  try {
    const userId = c.req.param('userId');
    const targetUser = await getUserProfile(userId);
    
    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Delete local auth/profile records
    await deleteLocalAuthRecord(userId);
    await kv.del(`user:${userId}`);

    // TODO: Send email notification
    console.log(`User ${targetUser.email} has been denied`);

    return c.json({ success: true, message: 'User denied and removed' });
  } catch (error) {
    console.error('Deny user error:', error);
    return c.json({ error: 'Failed to deny user' }, 500);
  }
});

// Get all users (admin only)
app.get("/make-server-50b25a4f/admin/users", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getUserProfile(user.id);
  
  if (profile.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin only' }, 403);
  }

  try {
    const allUsers = await kv.getByPrefix('user:');
    const users = allUsers
      .filter((u: any) => u && typeof u === 'object' && typeof u.id === 'string' && typeof u.email === 'string')
      .map((u: any) => normalizeUserProfile(u))
      .filter((u: any) => u && u.role !== 'admin');

    return c.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    return c.json({ error: 'Failed to get users' }, 500);
  }
});

// Get user full details (admin only)
app.get("/make-server-50b25a4f/admin/users/:id/details", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminProfile = await getUserProfile(user.id);
  if (!adminProfile || adminProfile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const userId = c.req.param("id");
    const targetUser = await getUserProfile(userId);
    if (!targetUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const [allListings, allReviews, allReports, allMessages, allTransactions, allOrders] = await Promise.all([
      kv.getByPrefix("listing:"),
      kv.getByPrefix("review:"),
      kv.getByPrefix("report:"),
      kv.getByPrefix("message:"),
      kv.getByPrefix("transaction:"),
      kv.getByPrefix("order:"),
    ]);

    const userListings = (allListings || [])
      .filter((listing: any) => listing?.sellerId === userId)
      .sort(sortByCreatedDesc);

    const reviewsReceived = (allReviews || [])
      .filter((review: any) => review?.sellerId === userId)
      .sort((a: any, b: any) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

    const reviewsWritten = (allReviews || [])
      .filter((review: any) => review?.reviewerId === userId)
      .sort((a: any, b: any) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

    const reportsAgainstUser = (allReports || [])
      .filter((report: any) => report?.targetUserId === userId)
      .sort(sortByCreatedDesc);

    const reportsByUser = (allReports || [])
      .filter((report: any) => report?.reporterId === userId)
      .sort(sortByCreatedDesc);

    const userMessages = (allMessages || [])
      .filter((message: any) => message?.senderId === userId || message?.receiverId === userId)
      .sort((a: any, b: any) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));

    const orderTransactions = (allOrders || []).map((order: any) => buildLegacyTransaction(order));
    const dedupedTransactions = new Map<string, any>();
    [...orderTransactions, ...(allTransactions || [])]
      .filter((transaction: any) => transaction && typeof transaction === "object" && typeof transaction.id === "string")
      .forEach((transaction: any) => dedupedTransactions.set(transaction.id, transaction));

    const transactionsHistory = Array.from(dedupedTransactions.values())
      .filter((transaction: any) => transaction?.buyerId === userId || transaction?.sellerId === userId)
      .sort((a: any, b: any) => String(b.createdAt || b.timestamp || "").localeCompare(String(a.createdAt || a.timestamp || "")));

    const ordersRelated = (allOrders || [])
      .filter((order: any) => order?.buyerId === userId || order?.sellerId === userId)
      .sort(sortByCreatedDesc);

    const activityLog: any[] = [];

    for (const listing of userListings) {
      activityLog.push({
        type: "listing_created",
        message: `Created listing: ${listing?.title || listing?.id || "Listing"}`,
        createdAt: listing?.createdAt || "",
        meta: {
          listingId: listing?.id || "",
        },
      });
    }

    for (const order of ordersRelated) {
      const role = order?.buyerId === userId ? "buyer" : "seller";
      activityLog.push({
        type: role === "buyer" ? "order_placed" : "order_received",
        message:
          role === "buyer"
            ? `Placed order for ${order?.listingTitle || order?.itemId || "item"}`
            : `Received order for ${order?.listingTitle || order?.itemId || "item"}`,
        createdAt: order?.createdAt || "",
        meta: {
          orderId: order?.id || "",
          status: order?.status || "",
        },
      });
    }

    for (const review of reviewsReceived) {
      activityLog.push({
        type: "review_received",
        message: `Received ${toSafeNumber(review?.rating, 0)}-star review`,
        createdAt: review?.timestamp || "",
        meta: {
          reviewId: review?.id || "",
        },
      });
    }

    for (const review of reviewsWritten) {
      activityLog.push({
        type: "review_written",
        message: `Wrote ${toSafeNumber(review?.rating, 0)}-star review`,
        createdAt: review?.timestamp || "",
        meta: {
          reviewId: review?.id || "",
        },
      });
    }

    for (const report of reportsAgainstUser) {
      activityLog.push({
        type: "report_against_user",
        message: `Report filed against user (${report?.category || "general"})`,
        createdAt: report?.createdAt || "",
        meta: {
          reportId: report?.id || "",
          status: report?.status || "",
        },
      });
    }

    for (const report of reportsByUser) {
      activityLog.push({
        type: "report_submitted",
        message: `Submitted report (${report?.category || "general"})`,
        createdAt: report?.createdAt || "",
        meta: {
          reportId: report?.id || "",
          status: report?.status || "",
        },
      });
    }

    for (const message of userMessages.slice(0, 80)) {
      const outgoing = message?.senderId === userId;
      activityLog.push({
        type: outgoing ? "message_sent" : "message_received",
        message: outgoing ? "Sent message" : "Received message",
        createdAt: message?.timestamp || "",
        meta: {
          messageId: message?.id || "",
          otherUserId: outgoing ? message?.receiverId : message?.senderId,
        },
      });
    }

    activityLog.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return c.json({
      user: targetUser,
      activityLog: activityLog.slice(0, 200),
      listings: userListings,
      reviewsReceived,
      transactionsHistory,
      reportsAgainstUser,
    });
  } catch (error) {
    console.error("Get admin user details error:", error);
    return c.json({ error: "Failed to get user details" }, 500);
  }
});

// Get all reviews (admin only)
app.get("/make-server-50b25a4f/admin/reviews", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const allReviews = (await kv.getByPrefix("review:")) || [];
    const reviews = await Promise.all(
      allReviews.map(async (review: any) => {
        const [reviewer, seller] = await Promise.all([
          review?.reviewerId ? getUserProfile(review.reviewerId) : Promise.resolve(null),
          review?.sellerId ? getUserProfile(review.sellerId) : Promise.resolve(null),
        ]);
        return {
          ...review,
          reviewerName: reviewer?.name || "Unknown User",
          sellerName: seller?.name || "Unknown User",
          reviewerIsBlocked: Boolean(reviewer?.isBanned),
        };
      }),
    );

    reviews.sort((a: any, b: any) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
    return c.json({ reviews });
  } catch (error) {
    console.error("Get admin reviews error:", error);
    return c.json({ error: "Failed to get reviews" }, 500);
  }
});

// Delete abusive review (admin only)
app.delete("/make-server-50b25a4f/admin/reviews/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const reviewId = decodeURIComponent(c.req.param("id"));
    const review = await kv.get(reviewId);
    if (!review) {
      return c.json({ error: "Review not found" }, 404);
    }

    await kv.del(reviewId);
    await recalculateSellerRating(review?.sellerId || "");

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete admin review error:", error);
    return c.json({ error: "Failed to delete review" }, 500);
  }
});

// Block spam reviewer (admin only)
app.post("/make-server-50b25a4f/admin/reviews/:id/block-reviewer", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const reviewId = decodeURIComponent(c.req.param("id"));
    const review = await kv.get(reviewId);
    if (!review?.reviewerId) {
      return c.json({ error: "Review not found" }, 404);
    }

    const reviewer = await getUserProfile(review.reviewerId);
    if (!reviewer) {
      return c.json({ error: "Reviewer not found" }, 404);
    }

    reviewer.isBanned = true;
    reviewer.updatedAt = new Date().toISOString();
    await kv.set(`user:${review.reviewerId}`, reviewer);

    return c.json({ success: true, reviewer });
  } catch (error) {
    console.error("Block reviewer error:", error);
    return c.json({ error: "Failed to block reviewer" }, 500);
  }
});

// List universities (public)
app.get("/make-server-50b25a4f/universities", async (c) => {
  try {
    const universities = await ensureAdminUniversities();
    return c.json({ universities: universities.filter((entry: any) => entry?.isActive) });
  } catch (error) {
    console.error("Get universities error:", error);
    return c.json(internalErrorPayload("Failed to get universities", error), 500);
  }
});

// List categories (public)
app.get("/make-server-50b25a4f/categories", async (c) => {
  try {
    const categories = await ensureAdminCategories();
    return c.json({ categories: categories.filter((entry: any) => entry?.isActive) });
  } catch (error) {
    console.error("Get categories error:", error);
    return c.json(internalErrorPayload("Failed to get categories", error), 500);
  }
});

// List universities (admin only)
app.get("/make-server-50b25a4f/admin/universities", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const universities = await ensureAdminUniversities();
    universities.sort((a: any, b: any) => String(a?.name || "").localeCompare(String(b?.name || "")));
    return c.json({ universities });
  } catch (error) {
    console.error("Get admin universities error:", error);
    return c.json({ error: "Failed to get universities" }, 500);
  }
});

// Add university (admin only)
app.post("/make-server-50b25a4f/admin/universities", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "University name is required" }, 400);

    const universities = await ensureAdminUniversities();
    const duplicate = universities.some((entry: any) => String(entry?.name || "").toLowerCase() === name.toLowerCase());
    if (duplicate) return c.json({ error: "University already exists" }, 400);

    const now = new Date().toISOString();
    const next = [
      ...universities,
      {
        id: createEntityId("UNI"),
        name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    await kv.set("admin:universities", next);
    return c.json({ success: true, universities: next });
  } catch (error) {
    console.error("Create university error:", error);
    return c.json({ error: "Failed to create university" }, 500);
  }
});

// Update university (admin only)
app.put("/make-server-50b25a4f/admin/universities/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const universityId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const universities = await ensureAdminUniversities();
    const idx = universities.findIndex((entry: any) => entry?.id === universityId);
    if (idx < 0) return c.json({ error: "University not found" }, 404);

    const current: any = universities[idx] || {};
    const nextName = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : String(current.name || "");
    const nextIsActive = typeof body?.isActive === "boolean" ? body.isActive : Boolean(current.isActive);
    universities[idx] = {
      ...current,
      name: nextName,
      isActive: nextIsActive,
      updatedAt: new Date().toISOString(),
    };
    await kv.set("admin:universities", universities);
    return c.json({ success: true, universities });
  } catch (error) {
    console.error("Update university error:", error);
    return c.json({ error: "Failed to update university" }, 500);
  }
});

// Delete university (admin only)
app.delete("/make-server-50b25a4f/admin/universities/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const universityId = c.req.param("id");
    const universities = await ensureAdminUniversities();
    const next = universities.filter((entry: any) => entry?.id !== universityId);
    await kv.set("admin:universities", next);
    return c.json({ success: true, universities: next });
  } catch (error) {
    console.error("Delete university error:", error);
    return c.json({ error: "Failed to delete university" }, 500);
  }
});

// List categories (admin only)
app.get("/make-server-50b25a4f/admin/categories", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const categories = await ensureAdminCategories();
    categories.sort((a: any, b: any) => String(a?.name || "").localeCompare(String(b?.name || "")));
    return c.json({ categories });
  } catch (error) {
    console.error("Get admin categories error:", error);
    return c.json({ error: "Failed to get categories" }, 500);
  }
});

// Add category (admin only)
app.post("/make-server-50b25a4f/admin/categories", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "Category name is required" }, 400);

    const categories = await ensureAdminCategories();
    const duplicate = categories.some((entry: any) => String(entry?.name || "").toLowerCase() === name.toLowerCase());
    if (duplicate) return c.json({ error: "Category already exists" }, 400);

    const now = new Date().toISOString();
    const next = [
      ...categories,
      {
        id: createEntityId("CAT"),
        name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    await kv.set("admin:categories", next);
    return c.json({ success: true, categories: next });
  } catch (error) {
    console.error("Create category error:", error);
    return c.json({ error: "Failed to create category" }, 500);
  }
});

// Update category (admin only)
app.put("/make-server-50b25a4f/admin/categories/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const categoryId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const categories = await ensureAdminCategories();
    const idx = categories.findIndex((entry: any) => entry?.id === categoryId);
    if (idx < 0) return c.json({ error: "Category not found" }, 404);

    const current: any = categories[idx] || {};
    const nextName = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : String(current.name || "");
    const nextIsActive = typeof body?.isActive === "boolean" ? body.isActive : Boolean(current.isActive);
    categories[idx] = {
      ...current,
      name: nextName,
      isActive: nextIsActive,
      updatedAt: new Date().toISOString(),
    };
    await kv.set("admin:categories", categories);
    return c.json({ success: true, categories });
  } catch (error) {
    console.error("Update category error:", error);
    return c.json({ error: "Failed to update category" }, 500);
  }
});

// Delete category (admin only)
app.delete("/make-server-50b25a4f/admin/categories/:id", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden - Admin only" }, 403);

  try {
    const categoryId = c.req.param("id");
    const categories = await ensureAdminCategories();
    const next = categories.filter((entry: any) => entry?.id !== categoryId);
    await kv.set("admin:categories", next);
    return c.json({ success: true, categories: next });
  } catch (error) {
    console.error("Delete category error:", error);
    return c.json({ error: "Failed to delete category" }, 500);
  }
});

// Analytics (admin only)
app.get("/make-server-50b25a4f/admin/analytics", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const [allListings, allTransactions, allOrders, allSubscriptionPayments, allUsers, categories, universities] = await Promise.all([
      kv.getByPrefix("listing:"),
      kv.getByPrefix("transaction:"),
      kv.getByPrefix("order:"),
      kv.getByPrefix("subscription_payment:"),
      kv.getByPrefix("user:"),
      ensureAdminCategories(),
      ensureAdminUniversities(),
    ]);

    const categoryNameMap = new Map<string, string>();
    for (const category of categories) {
      const key = String(category?.id || "").trim().toLowerCase();
      const name = String(category?.name || "").trim();
      if (key) categoryNameMap.set(key, name);
      if (name) categoryNameMap.set(name.toLowerCase(), name);
    }

    const universityNameMap = new Map<string, string>();
    for (const university of universities) {
      const key = String(university?.id || "").trim().toLowerCase();
      const name = String(university?.name || "").trim();
      if (key) universityNameMap.set(key, name);
      if (name) universityNameMap.set(name.toLowerCase(), name);
    }

    const listingsByDay = new Map<string, number>();
    for (const listing of allListings || []) {
      const day = toDayKey(listing?.createdAt);
      if (!day) continue;
      listingsByDay.set(day, (listingsByDay.get(day) || 0) + 1);
    }

    const transactionsFromOrders = (allOrders || []).map((order: any) => buildLegacyTransaction(order));
    const subscriptionTransactions = (allSubscriptionPayments || [])
      .filter((payment: any) => payment && typeof payment === "object")
      .map((payment: any) => buildSubscriptionTransaction(payment));
    const dedupedTransactions = new Map<string, any>();
    [...(allTransactions || []), ...subscriptionTransactions, ...transactionsFromOrders]
      .filter((transaction: any) => transaction && typeof transaction === "object" && typeof transaction.id === "string")
      .forEach((transaction: any) => dedupedTransactions.set(transaction.id, transaction));
    const transactionList = Array.from(dedupedTransactions.values());

    const transactionsByDay = new Map<string, number>();
    for (const transaction of transactionList) {
      const day = toDayKey(transaction?.createdAt || transaction?.timestamp);
      if (!day) continue;
      transactionsByDay.set(day, (transactionsByDay.get(day) || 0) + 1);
    }

    const topCategoriesMap = new Map<string, number>();
    for (const listing of allListings || []) {
      const rawCategory = String(listing?.category || "").trim();
      if (!rawCategory) continue;
      const resolvedCategory = categoryNameMap.get(rawCategory.toLowerCase()) || rawCategory;
      topCategoriesMap.set(resolvedCategory, (topCategoriesMap.get(resolvedCategory) || 0) + 1);
    }

    const topUniversitiesMap = new Map<string, number>();
    for (const u of allUsers || []) {
      if (!u || u.role === "admin") continue;
      const rawUniversity = String(u.university || "").trim();
      if (!rawUniversity) continue;
      const resolvedUniversity = universityNameMap.get(rawUniversity.toLowerCase()) || rawUniversity;
      topUniversitiesMap.set(resolvedUniversity, (topUniversitiesMap.get(resolvedUniversity) || 0) + 1);
    }

    const topSellersMap = new Map<string, { sellerId: string; sellerName: string; count: number; amount: number }>();
    for (const order of allOrders || []) {
      if (!order?.sellerId) continue;
      const sellerId = String(order.sellerId);
      const sellerProfile = (allUsers || []).find((u: any) => u?.id === sellerId);
      const current = topSellersMap.get(sellerId) || {
        sellerId,
        sellerName: sellerProfile?.name || "Unknown Seller",
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += toSafeNumber(order?.amount, 0);
      topSellersMap.set(sellerId, current);
    }

    const dailyListingsPosted = Array.from(listingsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dailyTransactions = Array.from(transactionsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topCategories = Array.from(topCategoriesMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topUniversities = Array.from(topUniversitiesMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topSellers = Array.from(topSellersMap.values())
      .sort((a, b) => b.amount - a.amount || b.count - a.count)
      .slice(0, 10);

    return c.json({
      dailyListingsPosted,
      dailyTransactions,
      topCategories,
      topUniversities,
      topSellers,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return c.json({ error: "Failed to get analytics" }, 500);
  }
});

// Get all transactions (admin only)
app.get("/make-server-50b25a4f/admin/transactions", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getUserProfile(user.id);
  
  if (profile.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin only' }, 403);
  }

  try {
    const allTransactions = (await kv.getByPrefix('transaction:')) || [];
    const allOrders = (await kv.getByPrefix('order:')) || [];
    const allSubscriptionPayments = (await kv.getByPrefix("subscription_payment:")) || [];
    const orderTransactions = allOrders.map((order: any) => buildLegacyTransaction(order));
    const subscriptionTransactions = allSubscriptionPayments
      .filter((payment: any) => payment && typeof payment === "object")
      .map((payment: any) => buildSubscriptionTransaction(payment));
    const dedupedById = new Map<string, any>();
    [...allTransactions, ...subscriptionTransactions, ...orderTransactions]
      .filter((txn: any) => txn && typeof txn === 'object' && typeof txn.id === 'string')
      .forEach((txn: any) => dedupedById.set(txn.id, txn));
    const normalized = Array.from(dedupedById.values())
      .sort((a: any, b: any) => String(b.createdAt || b.timestamp || '').localeCompare(String(a.createdAt || a.timestamp || '')));
    return c.json({ transactions: normalized });
  } catch (error) {
    console.error('Get all transactions error:', error);
    return c.json({ error: 'Failed to get transactions' }, 500);
  }
});

// Get all messages (admin only)
// Admin: view ALL conversations between buyers and sellers
// Admin: get all messages between two specific users
app.get("/make-server-50b25a4f/admin/conversation", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const uid1 = String(c.req.query("user1") || "").trim();
  const uid2 = String(c.req.query("user2") || "").trim();
  if (!uid1 || !uid2) return c.json({ error: "user1 and user2 required" }, 400);

  try {
    const allMessages = await kv.getByPrefix("message:");
    if (!Array.isArray(allMessages)) return c.json({ messages: [] });

    const msgs = allMessages
      .filter((m: any) => {
        if (!m || typeof m !== "object") return false;
        const { senderId, receiverId } = m as any;
        return (
          (senderId === uid1 && receiverId === uid2) ||
          (senderId === uid2 && receiverId === uid1)
        );
      })
      .sort((a: any, b: any) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      )
      .map((m: any) => ({
        id:         m.id,
        senderId:   m.senderId,
        receiverId: m.receiverId,
        content:    normalizeAiText(m.content, 2000),
        createdAt:  m.createdAt,
        messageType: m.messageType || "text",
      }));

    const [u1, u2] = await Promise.all([getUserProfile(uid1), getUserProfile(uid2)]);

    return c.json({
      messages: msgs,
      user1: { id: uid1, name: (u1 as any)?.name || "Unknown", userType: (u1 as any)?.userType },
      user2: { id: uid2, name: (u2 as any)?.name || "Unknown", userType: (u2 as any)?.userType },
    });
  } catch (err) {
    console.error("Admin conversation error:", err);
    return c.json({ messages: [] });
  }
});

app.get("/make-server-50b25a4f/admin/all-conversations", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  try {
    const allMessages = await kv.getByPrefix("message:");
    if (!Array.isArray(allMessages)) return c.json({ conversations: [] });

    // Group messages by conversation pair (sorted user IDs to avoid duplicates)
    const convMap = new Map<string, any[]>();
    for (const msg of allMessages) {
      if (!msg || typeof msg !== "object") continue;
      const { senderId, receiverId } = msg as any;
      if (!senderId || !receiverId) continue;
      const key = [senderId, receiverId].sort().join(":");
      const existing = convMap.get(key) || [];
      existing.push(msg);
      convMap.set(key, existing);
    }

    const conversations = [];
    for (const [key, msgs] of convMap.entries()) {
      const sorted = msgs.sort((a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      const latest = sorted[0];
      const [uid1, uid2] = key.split(":");
      const [u1, u2] = await Promise.all([getUserProfile(uid1), getUserProfile(uid2)]);
      conversations.push({
        key,
        user1: { id: uid1, name: (u1 as any)?.name || "Unknown", userType: (u1 as any)?.userType },
        user2: { id: uid2, name: (u2 as any)?.name || "Unknown", userType: (u2 as any)?.userType },
        messageCount: msgs.length,
        latestMessage: normalizeAiText((latest as any)?.content, 100),
        latestAt: (latest as any)?.createdAt || "",
      });
    }

    conversations.sort((a, b) =>
      new Date(b.latestAt || 0).getTime() - new Date(a.latestAt || 0).getTime()
    );

    return c.json({ conversations: conversations.slice(0, 100) });
  } catch (err) {
    console.error("Admin all-conversations error:", err);
    return c.json({ conversations: [] });
  }
});

app.get("/make-server-50b25a4f/admin/messages", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const rawMessageIds = await kv.get(`admin:messages`);
    const messageIds = Array.isArray(rawMessageIds)
      ? Array.from(new Set(rawMessageIds.filter((id: unknown): id is string => typeof id === 'string')))
      : [];
    const messages = await Promise.all(
      messageIds.map(async (id) => await kv.get(`message:${id}`))
    );
    const normalizedMessages = messages
      .filter((m: any) =>
        m &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        typeof m.senderId === 'string' &&
        typeof m.receiverId === 'string' &&
        typeof m.content === 'string',
      )
      .map((m: any) => ({
        ...m,
        messageType: m.messageType === 'voice' || m.messageType === 'image' ? m.messageType : 'text',
        audioData: typeof m.audioData === 'string' ? m.audioData : null,
        attachmentData: typeof m.attachmentData === 'string' ? m.attachmentData : null,
        isEdited: Boolean(m.isEdited),
        isDeleted: Boolean(m.isDeleted),
      }))
      .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    return c.json({ messages: normalizedMessages });
  } catch (error) {
    console.error('Get admin messages error:', error);
    return c.json({ messages: [] });
  }
});

// Get admin settings (admin only)
app.get("/make-server-50b25a4f/admin/settings", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const settings = await getAdminSettings();
    return c.json({ settings });
  } catch (error) {
    console.error("Get admin settings error:", error);
    return c.json({ error: "Failed to get settings" }, 500);
  }
});

// Update admin settings (admin only)
app.put("/make-server-50b25a4f/admin/settings", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const body = await c.req.json();
    const merged = await getAdminSettings();
    const resolvedCommission =
      body.platformCommissionPercent !== undefined
        ? Math.max(0, toSafeNumber(body.platformCommissionPercent, merged.platformCommissionPercent))
        : (
          body.payoutFeePercent !== undefined
            ? Math.max(0, toSafeNumber(body.payoutFeePercent, merged.platformCommissionPercent))
            : merged.platformCommissionPercent
        );

    const settings = {
      ...merged,
      platformName:
        typeof body.platformName === "string" && body.platformName.trim().length > 0
          ? body.platformName.trim()
          : merged.platformName,
      supportEmail:
        typeof body.supportEmail === "string" && body.supportEmail.trim().length > 0
          ? body.supportEmail.trim()
          : merged.supportEmail,
      maintenanceMode:
        typeof body.maintenanceMode === "boolean"
          ? body.maintenanceMode
          : merged.maintenanceMode,
      allowNewRegistrations:
        typeof body.allowNewRegistrations === "boolean"
          ? body.allowNewRegistrations
          : merged.allowNewRegistrations,
      platformCommissionPercent: resolvedCommission,
      payoutFeePercent: resolvedCommission,
      minimumPayoutAmount:
        body.minimumPayoutAmount !== undefined
          ? Math.max(0, toSafeNumber(body.minimumPayoutAmount, merged.minimumPayoutAmount))
          : merged.minimumPayoutAmount,
      autoPayoutToMobileMoney:
        typeof body.autoPayoutToMobileMoney === "boolean"
          ? body.autoPayoutToMobileMoney
          : merged.autoPayoutToMobileMoney,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set("admin:settings", settings);
    return c.json({ success: true, settings });
  } catch (error) {
    console.error("Update admin settings error:", error);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

// List broadcasts (admin only)
app.get("/make-server-50b25a4f/admin/broadcasts", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const allBroadcasts = await kv.getByPrefix("broadcast:");
    const broadcasts = (allBroadcasts || [])
      .filter((b: any) => b && typeof b === "object" && typeof b.id === "string")
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return c.json({ broadcasts });
  } catch (error) {
    console.error("Get broadcasts error:", error);
    return c.json({ error: "Failed to get broadcasts" }, 500);
  }
});

// Create broadcast (admin only)
app.post("/make-server-50b25a4f/admin/broadcasts", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const body = await c.req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const priority = ["normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal";
    const target = ["all", "buyers", "sellers"].includes(body.target) ? body.target : "all";

    if (!title || !message) {
      return c.json({ error: "Title and message are required" }, 400);
    }

    const id = `broadcast-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const broadcast = {
      id,
      title,
      message,
      priority,
      target,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`broadcast:${id}`, broadcast);
    return c.json({ success: true, broadcast });
  } catch (error) {
    console.error("Create broadcast error:", error);
    return c.json({ error: "Failed to create broadcast" }, 500);
  }
});

// List payout summaries (admin only)
app.get("/make-server-50b25a4f/admin/payouts", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const { payouts, settings } = await buildPayoutSummaries();
    return c.json({ payouts, settings });
  } catch (error) {
    console.error("Get payouts error:", error);
    return c.json({ error: "Failed to get payouts" }, 500);
  }
});

// Get platform revenue wallet summary (admin only)
app.get("/make-server-50b25a4f/admin/platform-wallet", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const summary = await getPlatformRevenueWalletSummary();
    const defaultPhoneNumber = normalizePhone(profile.phone || "");
    return c.json({
      ...summary,
      defaultPhoneNumber,
    });
  } catch (error) {
    console.error("Get platform revenue wallet error:", error);
    return c.json({ error: "Failed to load platform revenue wallet" }, 500);
  }
});

// Withdraw platform revenue to mobile money (admin only)
app.post("/make-server-50b25a4f/admin/platform-wallet/withdraw", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const amount = roundXafAmount(body?.amount);
    const provider = body?.provider === "orange-money" ? "orange-money" : "mtn-momo";
    const phoneNumber = normalizePhone(body?.phoneNumber || profile.phone || "");

    if (!amount || amount <= 0) {
      return c.json({ error: "Withdrawal amount must be greater than zero" }, 400);
    }
    if (!isValidCameroonPhone(phoneNumber)) {
      return c.json({ error: "A valid Cameroon phone number is required" }, 400);
    }

    const platformWallet = await getWallet(ADMIN_WALLET_USER_ID);
    if (platformWallet.availableBalance < amount) {
      return c.json({ error: "Insufficient platform revenue balance" }, 400);
    }

    const now = new Date().toISOString();
    const withdrawalId = createEntityId("WD");
    const payoutReference = `ADMIN-REV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payoutResult = await processOutboundMobileMoneyPayout({
      amount,
      phoneNumber,
      provider,
      reference: payoutReference,
      description: `Platform revenue withdrawal by admin ${user.id}`,
    });
    const payoutStatus = String(payoutResult.status || "").toLowerCase();
    const completedStatuses = new Set(["successful", "success", "completed"]);
    const withdrawalStatus = completedStatuses.has(payoutStatus)
      ? WITHDRAWAL_STATUS.COMPLETED
      : WITHDRAWAL_STATUS.PROCESSING;

    await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: -amount });

    const withdrawal = {
      id: withdrawalId,
      userId: ADMIN_WALLET_USER_ID,
      amount,
      provider,
      phoneNumber,
      status: withdrawalStatus,
      reference: payoutResult.reference || payoutReference,
      providerStatus: payoutResult.status,
      providerName: payoutResult.provider,
      providerPayload: payoutResult.raw,
      note:
        withdrawalStatus === WITHDRAWAL_STATUS.COMPLETED
          ? "Platform revenue withdrawn to mobile money"
          : "Platform revenue payout accepted and processing with provider",
      createdAt: now,
      updatedAt: now,
      processedBy: user.id,
      source: "admin-platform-withdrawal",
    };

    await kv.set(`withdrawal:${withdrawalId}`, withdrawal);
    await indexFapshiPayout(payoutResult, withdrawalId);
    const platformWithdrawals = (await kv.get(`user:${ADMIN_WALLET_USER_ID}:withdrawals`)) || [];
    platformWithdrawals.push(withdrawalId);
    await kv.set(`user:${ADMIN_WALLET_USER_ID}:withdrawals`, platformWithdrawals);

    const summary = await getPlatformRevenueWalletSummary();
    return c.json({ success: true, withdrawal, ...summary });
  } catch (error) {
    console.error("Platform revenue withdrawal error:", error);
    const message = error instanceof Error ? error.message : "Failed to process platform revenue withdrawal";
    return c.json({ error: message }, 500);
  }
});

// Mark payout as paid (admin only)
app.post("/make-server-50b25a4f/admin/payouts/:sellerId/pay", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const sellerId = c.req.param("sellerId");
    const { payouts } = await buildPayoutSummaries();
    const payout = payouts.find((p: any) => p.sellerId === sellerId);

    if (!payout) {
      return c.json({ error: "Seller payout not found" }, 404);
    }

    if (payout.pendingAmount <= 0) {
      return c.json({ error: "No pending amount to pay" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const requestedAmount = toSafeNumber(body?.amount, payout.pendingAmount);
    const amountToPay = roundXafAmount(Math.min(Math.max(0, requestedAmount), payout.pendingAmount));

    if (amountToPay <= 0) {
      return c.json({ error: "Invalid payout amount" }, 400);
    }

    const now = new Date().toISOString();
    const payoutId = createEntityId("WD");
    const sellerProfile = await getUserProfile(sellerId);
    const payoutProvider = body?.provider === "orange-money" ? "orange-money" : "mtn-momo";
    const sellerPhone = normalizePhone(body?.phoneNumber || sellerProfile?.phone || "");
    if (!isValidCameroonPhone(sellerPhone)) {
      return c.json({ error: "Seller phone number is required for payout" }, 400);
    }
    const payoutReference = `ADMIN-PAYOUT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payoutResult = await processOutboundMobileMoneyPayout({
      amount: amountToPay,
      phoneNumber: sellerPhone,
      provider: payoutProvider,
      reference: payoutReference,
      description: `Admin payout for seller ${sellerId}`,
    });
    await adjustWallet(sellerId, { availableDelta: -amountToPay });
    const adminPayoutStatus = ["successful", "success", "completed"].includes(
      String(payoutResult.status || "").toLowerCase(),
    )
      ? WITHDRAWAL_STATUS.COMPLETED
      : WITHDRAWAL_STATUS.PROCESSING;
    const payoutRecord = {
      id: payoutId,
      userId: sellerId,
      amount: roundXafAmount(amountToPay),
      provider: payoutProvider,
      phoneNumber: sellerPhone,
      status: adminPayoutStatus,
      note: "Admin payout processed from dashboard",
      reference: payoutResult.reference || payoutReference,
      providerStatus: payoutResult.status,
      providerName: payoutResult.provider,
      providerPayload: payoutResult.raw,
      createdAt: now,
      updatedAt: now,
      processedBy: user.id,
      source: "admin-payout",
    };
    await kv.set(`withdrawal:${payoutId}`, payoutRecord);
    await indexFapshiPayout(payoutResult, payoutId);
    const sellerWithdrawals = (await kv.get(`user:${sellerId}:withdrawals`)) || [];
    sellerWithdrawals.push(payoutId);
    await kv.set(`user:${sellerId}:withdrawals`, sellerWithdrawals);

    const { payouts: refreshed } = await buildPayoutSummaries();
    const updatedPayout = refreshed.find((p: any) => p.sellerId === sellerId);

    return c.json({ success: true, payout: updatedPayout, withdrawal: payoutRecord });
  } catch (error) {
    console.error("Process payout error:", error);
    const message = error instanceof Error ? error.message : "Failed to process payout";
    return c.json({ error: message }, 500);
  }
});

// Reconcile a subscription payment and activate account (admin only)
app.post("/make-server-50b25a4f/admin/subscriptions/activate/:userId", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminProfile = await getUserProfile(user.id);
  if (!adminProfile || adminProfile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const userId = c.req.param("userId");
    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    const profile = await getUserProfile(userId);
    if (!profile || profile.role === "admin") {
      return c.json({ error: "Student user not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const plan = body?.plan === "yearly" ? "yearly" : "monthly";
    const paymentMethod = body?.paymentMethod === "orange-money" ? "orange-money" : "mtn-momo";
    const providedPhone = normalizePhone(body?.phoneNumber || "");
    const phoneNumber = isValidCameroonPhone(providedPhone)
      ? providedPhone
      : normalizePhone(profile.phone || "");

    if (!isValidCameroonPhone(phoneNumber)) {
      return c.json({ error: "A valid Cameroon phone number is required" }, 400);
    }

    const userType = profile.userType === "seller" ? "seller" : "buyer";
    const baseAmount = roundXafAmount(SUBSCRIPTION_PLAN_PRICING[userType][plan]);
    const transactionFee = userType === "buyer" && plan === "monthly"
      ? 0
      : calculateTransactionFee(baseAmount);
    const totalCharged = roundXafAmount(baseAmount + transactionFee);

    const now = new Date();
    const nowIso = now.toISOString();
    const endDate = new Date(now.getTime());
    if (plan === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const reference = typeof body?.providerReference === "string" && body.providerReference.trim()
      ? body.providerReference.trim()
      : `ADMIN-SUB-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const updatedProfile = {
      ...profile,
      phone: phoneNumber,
      subscriptionStatus: "active",
      subscriptionPlan: plan,
      subscriptionStartDate: nowIso,
      subscriptionEndDate: endDate.toISOString(),
      subscriptionPaymentMethod: paymentMethod,
      subscriptionPhoneNumber: phoneNumber,
      subscriptionAmount: baseAmount,
      subscriptionTransactionFee: transactionFee,
      subscriptionTotalCharged: totalCharged,
      subscriptionReference: reference,
      subscriptionUpdatedAt: nowIso,
    };
    await kv.set(`user:${userId}`, updatedProfile);

    await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: totalCharged });

    const paymentId = createEntityId("SUBPAY");
    const paymentRecord = {
      id: paymentId,
      userId,
      plan,
      userType,
      amount: baseAmount,
      transactionFee,
      totalCharged,
      paymentMethod,
      phoneNumber,
      merchantName: MERCHANT_MOMO_NAME,
      merchantNumber: MERCHANT_MOMO_NUMBER,
      provider: "admin-manual",
      providerStatus: "successful",
      providerReference: reference,
      providerPayload: {
        source: "admin_reconciliation",
        reconciledBy: user.id,
      },
      createdAt: nowIso,
    };
    await kv.set(`subscription_payment:${paymentId}`, paymentRecord);
    await kv.set(`transaction:${paymentId}`, buildSubscriptionTransaction(paymentRecord));
    const paymentIds = (await kv.get(`user:${userId}:subscriptionPayments`)) || [];
    paymentIds.push(paymentId);
    await kv.set(`user:${userId}:subscriptionPayments`, paymentIds);

    await createUserNotification(userId, {
      type: "subscription_activated",
      title: "Subscription Activated",
      message: `Your ${plan} subscription has been activated.`,
      priority: "high",
      data: {
        subscriptionPlan: plan,
        subscriptionEndDate: updatedProfile.subscriptionEndDate,
      },
    });

    return c.json({
      success: true,
      message: "Subscription activated and reconciled",
      user: updatedProfile,
      payment: paymentRecord,
    });
  } catch (error) {
    console.error("Admin subscription reconciliation error:", error);
    return c.json({ error: "Failed to reconcile subscription" }, 500);
  }
});

// ============ ADMIN USER MANAGEMENT ============

// Ban/Unban a user (admin only)
app.post("/make-server-50b25a4f/admin/users/:id/toggle-ban", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  if (!user || (await getUserProfile(user.id)).role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const userIdToToggle = c.req.param('id');
  try {
    const userProfile = await getUserProfile(userIdToToggle);
    if (!userProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updatedProfile = { ...userProfile, isBanned: !userProfile.isBanned };
    await kv.set(`user:${userIdToToggle}`, updatedProfile);

    return c.json({ success: true, user: updatedProfile });
  } catch (error) {
    console.error('Toggle ban error:', error);
    return c.json({ error: 'Failed to update user status' }, 500);
  }
});

// Delete a user (admin only)
app.delete("/make-server-50b25a4f/admin/users/:id", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  if (!user || (await getUserProfile(user.id)).role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const userIdToDelete = c.req.param('id');
  try {
    await deleteLocalAuthRecord(userIdToDelete);
    await kv.del(`user:${userIdToDelete}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// ============ AI ASSISTANT ROUTES ============

app.get("/make-server-50b25a4f/ai-chat/history", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  try {
    const usageSnapshot = await getAiDailyUsageSnapshot(c.req.raw, user?.id);
    const requestedConversationId = normalizeAiConversationId(c.req.query("conversationId"));
    if (!user) {
      return c.json({
        messages: [],
        conversations: [],
        activeConversationId: "",
        usage: toPublicAiUsageSnapshot(usageSnapshot),
      });
    }

    const storedConversations = await kv.get(aiChatConversationsKey(user.id));
    const legacyHistory = await kv.get(aiChatHistoryKey(user.id));
    const conversations = normalizeAiConversationsForUser(storedConversations, legacyHistory);

    if (conversations.length > 0 && (!Array.isArray(storedConversations) || storedConversations.length === 0)) {
      await kv.set(aiChatConversationsKey(user.id), conversations);
    }

    const activeConversation = requestedConversationId
      ? (conversations.find((entry: any) => entry.id === requestedConversationId) || conversations[0])
      : conversations[0];

    return c.json({
      messages: activeConversation?.messages || [],
      conversations,
      activeConversationId: activeConversation?.id || "",
      usage: toPublicAiUsageSnapshot(usageSnapshot),
    });
  } catch (error) {
    console.error("Get AI chat history error:", error);
    return c.json({ error: "Failed to load AI chat history" }, 500);
  }
});

app.get("/make-server-50b25a4f/ai-chat/preferences", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ preferences: mergeAiPreferences({}, {}) });
  }

  try {
    const preferences = mergeAiPreferences(await kv.get(aiPreferenceKey(user.id)), {});
    return c.json({ preferences });
  } catch (error) {
    console.error("Get AI preferences error:", error);
    return c.json({ error: "Failed to load AI preferences" }, 500);
  }
});

app.delete("/make-server-50b25a4f/ai-chat/history", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const requestedConversationId = normalizeAiConversationId(c.req.query("conversationId"));
    if (requestedConversationId) {
      const storedConversations = await kv.get(aiChatConversationsKey(user.id));
      const legacyHistory = await kv.get(aiChatHistoryKey(user.id));
      const conversations = normalizeAiConversationsForUser(storedConversations, legacyHistory);
      const remainingConversations = conversations.filter((entry: any) => entry.id !== requestedConversationId);

      if (remainingConversations.length > 0) {
        await kv.set(aiChatConversationsKey(user.id), remainingConversations);
        await kv.set(aiChatHistoryKey(user.id), remainingConversations[0].messages);
      } else {
        await kv.del(aiChatConversationsKey(user.id));
        await kv.del(aiChatHistoryKey(user.id));
      }

      return c.json({
        success: true,
        conversations: remainingConversations,
        activeConversationId: remainingConversations[0]?.id || "",
      });
    }

    await kv.del(aiChatConversationsKey(user.id));
    await kv.del(aiChatHistoryKey(user.id));
    return c.json({ success: true, conversations: [], activeConversationId: "" });
  } catch (error) {
    console.error("Clear AI chat history error:", error);
    return c.json({ error: "Failed to clear AI chat history" }, 500);
  }
});

app.post("/make-server-50b25a4f/ai-chat/transcribe", async (c) => {
  try {
    const formData = await c.req.formData();
    const audio = formData.get("audio") || formData.get("file");

    if (!(audio instanceof File)) {
      return c.json({ error: "Audio file is required" }, 400);
    }

    // Try OpenAI first; fall back to HuggingFace Whisper if key is missing.
    let transcription = await requestOpenAiTranscription(audio);
    if (!transcription.ok && HUGGING_FACE_API_KEY) {
      transcription = await requestHuggingFaceTranscription(audio);
    }

    if (!transcription.ok) {
      return c.json({ error: transcription.error || "Failed to transcribe audio" }, 502);
    }

    return c.json({ text: transcription.text || "" });
  } catch (error) {
    console.error("AI transcription error:", error);
    return c.json({ error: "Failed to transcribe audio" }, 500);
  }
});

app.post("/make-server-50b25a4f/ai-chat/analytics", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const eventType = normalizeAiText(body?.eventType, 80);
    const itemId = normalizeAiText(body?.itemId, 120);
    if (!eventType || !itemId) {
      return c.json({ error: "eventType and itemId are required" }, 400);
    }

    const previous = normalizeAiAnalyticsEvents(await kv.get(aiAnalyticsKey(user.id)));
    const next = normalizeAiAnalyticsEvents([
      ...previous,
      {
        id: createEntityId("AIEVT"),
        eventType,
        itemId,
        metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
        createdAt: new Date().toISOString(),
      },
    ]);

    await kv.set(aiAnalyticsKey(user.id), next);
    return c.json({ success: true });
  } catch (error) {
    console.error("AI analytics error:", error);
    return c.json({ error: "Failed to record AI analytics event" }, 500);
  }
});

app.post("/make-server-50b25a4f/ai-chat", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));
  let usageSnapshot: AiDailyUsageSnapshot | null = null;

  try {
    const body = await c.req.json().catch(() => ({}));
    const message = normalizeAiText(body?.message, 3000);
    if (!message) {
      return c.json({ error: "Message is required" }, 400);
    }

    usageSnapshot = await getAiDailyUsageSnapshot(c.req.raw, user?.id);
    if (usageSnapshot.remaining <= 0) {
      return c.json(
        {
          error:
            `You have reached your ${usageSnapshot.limit}-question limit for the last 24 hours. ` +
            "Please come back tomorrow to continue.",
          usage: toPublicAiUsageSnapshot(usageSnapshot),
        },
        429,
      );
    }
    usageSnapshot = await incrementAiDailyUsage(usageSnapshot);

    const images = extractDataUrlImages(body?.images);
    const location = normalizeAiLocation(body?.location);
    const clientHistory = normalizeAiHistoryEntries(body?.clientHistory);
    const requestedConversationId = normalizeAiConversationId(body?.conversationId);
    const requestedConversationTitle = normalizeAiText(body?.conversationTitle, 120);
    const inferredIntent = detectPrimaryIntent(message);

    // Handle greetings instantly on the server — no AI call needed, always reliable.
    if (inferredIntent === "greeting") {
      const msg = message.toLowerCase().trim();
      let reply = "I'm doing great, thanks for asking! 😊 What can I help you with today?";
      if (/^(hi|hello|hey|hiya|howdy|yo|sup)/.test(msg)) {
        reply = "Hey! 👋 I'm Sasha, your Campus Market assistant. How are you doing? What can I help you with today? 😊";
      } else if (/good morning/.test(msg)) {
        reply = "Good morning! ☀️ Hope you're having a great day. What can I help you with today?";
      } else if (/good afternoon/.test(msg)) {
        reply = "Good afternoon! 😊 How can I help you today?";
      } else if (/good evening|good night/.test(msg)) {
        reply = "Good evening! 🌙 How can I help you today?";
      } else if (/how are you|how r u|how are u|how.*doing|how.*going|how.*things|you good/.test(msg)) {
        reply = "I'm doing great, thanks for asking! 😄 Always ready to help. What's on your mind?";
      } else if (/^(yes|yeah|yep|sure|ok|okay|alright|go ahead|please)/.test(msg)) {
        reply = "Of course! 😊 Could you tell me a bit more? For example — what are you looking for, and what's your budget?";
      } else if (/^(no|nope|nah)/.test(msg)) {
        reply = "No problem at all! 😊 Let me know whenever you need help — I'm always here.";
      } else if (/^(thanks|thank you|merci|thx)/.test(msg)) {
        reply = "You're welcome! 😊 Let me know if there's anything else I can help with.";
      } else if (/^(bye|goodbye|see you|later|ciao)/.test(msg)) {
        reply = "Goodbye! 👋 Come back anytime. Have a great day! 😊";
      }
      return c.json({
        success: true,
        intent: "greeting",
        assistantMessage: reply,
        recommendedItems: [],
        stylePlan: null,
        kitchenList: null,
        budgetBreakdown: null,
        nextQuestions: ["What are you looking for?", "Show me products on the marketplace", "What can Sasha do?"],
        messages: [],
        conversationId: "",
        activeConversationId: "",
        conversations: [],
        preferences: {},
        usage: toPublicAiUsageSnapshot(usageSnapshot),
        metadata: { model: "sasha-instant", source: "server", warning: "" },
      });
    }

    const savedPreferences = user
      ? mergeAiPreferences(await kv.get(aiPreferenceKey(user.id)), {})
      : mergeAiPreferences({}, {});

    const effectiveLocation = {
      ...(location || {}),
      city: normalizeAiText(location?.city || savedPreferences.preferredCity || "", 120),
      university: normalizeAiText(location?.university || savedPreferences.preferredUniversity || "", 120),
      country: normalizeAiText(location?.country || "Cameroon", 120),
    };

    const storedConversations = user
      ? normalizeAiConversationsForUser(
        await kv.get(aiChatConversationsKey(user.id)),
        await kv.get(aiChatHistoryKey(user.id)),
      )
      : [];

    const selectedConversation = user
      ? (
        requestedConversationId
          ? (
            storedConversations.find((entry: any) => entry.id === requestedConversationId) ||
            {
              id: requestedConversationId,
              title: requestedConversationTitle || "New chat",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: [],
            }
          )
          : (
            storedConversations[0] ||
            {
              id: createEntityId("AITHR"),
              title: requestedConversationTitle || "New chat",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: [],
            }
          )
      )
      : null;

    const activeHistory = (
      user
        ? normalizeAiHistoryEntries(selectedConversation?.messages)
        : clientHistory
    ).slice(-20);

    const listings = await getAvailableListingsForAi();
    const preferenceSearchTerms = [
      savedPreferences.preferredStyle,
      savedPreferences.preferredCity,
      savedPreferences.preferredUniversity,
      inferredIntent,
    ]
      .filter(Boolean)
      .join(" ");
    const searchTokens = extractSearchTokens(
      [message, preferenceSearchTerms, activeHistory.map((entry: any) => entry.content).join(" ")].join(" "),
    );
    const budgetFromMessage = parseBudgetFromText(message);
    const budget = budgetFromMessage || (
      savedPreferences.budgetMax > 0
        ? {
          min: savedPreferences.budgetMin,
          max: savedPreferences.budgetMax,
        }
        : null
    );

    const rankedListings = listings
      .map((listing: any) => ({
        listing,
        score: scoreListingForQuery(listing, searchTokens, effectiveLocation, budget),
      }))
      .filter((entry: any) => Number.isFinite(entry.score))
      .sort((a: any, b: any) => b.score - a.score);

    const topRankedListings = rankedListings
      .slice(0, AI_MAX_PROMPT_LISTINGS)
      .map((entry: any) => entry.listing);

    const listingsContext = topRankedListings.map((listing: any) => ({
      id: String(listing.id || ""),
      title: String(listing.title || ""),
      description: String(listing.description || ""),
      price: Math.max(0, toSafeNumber(listing.price, 0)),
      category: String(listing.category || ""),
      type: listing.type === "rent" ? "rent" : "sell",
      location: String(listing.location || ""),
      sellerUniversity: String(listing?.seller?.university || ""),
      sellerRating: Math.max(0, toSafeNumber(listing?.seller?.rating, 0)),
      likesCount: Math.max(0, toSafeNumber(listing.likesCount, 0)),
      views: Math.max(0, toSafeNumber(listing.views, 0)),
      status: String(listing.status || ""),
    }));

    const systemPrompt = [
      "You are Sasha, a smart, friendly AI assistant for Campus Market — a student marketplace in Cameroon.",
      "You behave like a knowledgeable, warm friend. You can discuss ANYTHING and also help students find products.",
      "",
      "PERSONALITY: Warm, natural, conversational. Use emojis moderately. Never sound robotic.",
      "",
      "CONVERSATION RULES (READ CAREFULLY):",
      "- ALWAYS read the full conversation history to understand context before replying.",
      "- Short replies like 'yes', 'ok', 'sure', 'no', 'please', 'go ahead' are follow-ups — respond based on what was discussed before.",
      "- Example: if you listed kitchen items and the user says 'yes', they want you to search the marketplace for those items.",
      "- Example: if you asked 'what is your budget?' and the user says '50000', use that budget in your response.",
      "- NEVER ignore context. NEVER give a generic response when the user is clearly replying to something.",
      "",
      "GREETINGS: Respond warmly with no product recommendations.",
      "- 'hi' → 'Hey! 👋 How are you doing? I'm Sasha, your Campus Market assistant 😊 What can I help you with today?'",
      "- 'how are you?' → 'I'm doing great, thanks for asking! 😄 Ready to help you find products or answer any question. What's on your mind?'",
      "- 'good morning' → 'Good morning! ☀️ Hope your day is going well. Looking for something today?'",
      "",
      "WHAT YOU CAN DO:",
      "1. Answer ANY question — science, math, history, coding, health, recipes, career, student life, general knowledge.",
      "2. List items for rooms, kitchens, study setups, or any category with helpful details.",
      "3. Recommend products from the marketplace listings provided.",
      "4. Help compare options, plan budgets, and make shopping decisions.",
      "",
      "ANSWERING GENERAL QUESTIONS:",
      "- Always give a real, complete, helpful answer. Never say 'I don't know' for common knowledge.",
      "- Science: explain with examples. Math: show the working. History: give context. Coding: show code snippets.",
      "- Be specific and educational. Think like a smart tutor.",
      "",
      "PRODUCT RULES:",
      "- Only recommend items from the provided listings JSON with their exact IDs.",
      "- Never invent products, prices, or sellers.",
      "- If no matching items exist, say so and give general advice instead.",
      "",
      "CONTEXT: Students in Cameroon. Cities: Yaoundé, Douala, Buea, Bamenda, Dschang. Currency: XAF/FCFA.",
      "",
      "Return ONLY valid JSON (no markdown, no extra text):",
      "{",
      '  "intent": string,',
      '  "assistant_message": string,',
      '  "recommended_item_ids": string[],',
      '  "recommendation_reasons": { "<id>": "<reason>" },',
      '  "style_plan": null,',
      '  "kitchen_list": null,',
      '  "budget_breakdown": null,',
      '  "next_questions": string[]',
      "}",
      "Intent: greeting, general_qa, product_recommendation, room_setup, kitchen_list, shopping_plan, student_advice, tech_help, coding_help, math_help, science_qa, career_advice, other.",
      "IMPORTANT: assistant_message must NEVER be empty. Always give a complete, helpful answer.",
      "IMPORTANT: For greetings/general questions, recommended_item_ids = []. Only add IDs for real marketplace shopping requests.",
    ].join("\n");

    const modelResponse = await requestAiChatResponse({
      systemPrompt,
      // For general questions, skip the large listings context — makes the model
      // respond faster and more accurately for non-shopping queries.
      listingsContext: ["product_recommendation","room_setup","kitchen_setup","kitchen_list","shopping_plan","buyer_guide","cheaper_alternatives","similar_items"].some((i) => inferredIntent === i) ? listingsContext : [],
      history: activeHistory,
      userMessage: message,
      imageDataUrls: images,
      location: {
        ...effectiveLocation,
        preferences: savedPreferences,
      },
    });

    const parsedModel = modelResponse.ok
      ? parseJsonFromModelText(modelResponse.content || "")
      : null;

    const fallbackPlainReply =
      modelResponse.ok && !parsedModel
        ? normalizeAiText(modelResponse.content || "", 5000)
        : "";

    const requestedIds = Array.isArray(parsedModel?.recommended_item_ids)
      ? parsedModel.recommended_item_ids
        .map((value: unknown) => normalizeAiText(value, 100))
        .filter(Boolean)
      : [];

    const reasonsMap =
      parsedModel?.recommendation_reasons && typeof parsedModel.recommendation_reasons === "object"
        ? parsedModel.recommendation_reasons
        : {};

    // Determine intent early so we know whether to show products at all.
    const rawIntent = normalizeAiText(parsedModel?.intent, 80) || inferredIntent || "";
    const PRODUCT_INTENTS = [
      "product_recommendation", "room_setup", "kitchen_list", "kitchen_setup",
      "shopping_plan", "buyer_guide", "cheaper_alternatives", "similar_items",
    ];
    const isShoppingIntent =
      PRODUCT_INTENTS.some((i) => rawIntent.toLowerCase().includes(i)) ||
      requestedIds.length > 0;

    // Start with AI-recommended listings by ID.
    const selectedListings: any[] = [];
    for (const id of requestedIds) {
      const match = topRankedListings.find((listing: any) => String(listing.id) === id);
      if (match && !selectedListings.find((entry: any) => entry.id === match.id)) {
        selectedListings.push(match);
      }
      if (selectedListings.length >= 6) break;
    }

    // If AI found nothing but user is shopping → smart server-side keyword search.
    if (isShoppingIntent && selectedListings.length === 0) {
      const STOP_WORDS = new Set(["the","and","for","are","can","you","what","show","list","want","need","buy","get","me","my","a","an","in","of","to","i","is","it","at","be","do","so","on","or","ok","yes","no","please","some","give","find","search","marketplace","campus","market","products","items","things"]);
      const keywords = message.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));

      // Category synonyms — map user words to likely categories
      const CATEGORY_MAP: Record<string, string[]> = {
        furniture: ["furniture","chair","desk","table","wardrobe","shelf","bed","sofa","couch","cabinet","drawer"],
        electronics: ["laptop","computer","phone","tablet","camera","speaker","headphone","earphone","charger","gadget","electronic","screen","monitor","keyboard","mouse"],
        kitchen: ["pot","pan","stove","kettle","blender","plate","bowl","cup","spoon","fork","knife","cooker","fridge","gas","cooking","kitchen","utensil"],
        clothing: ["shirt","trouser","dress","shoe","bag","cloth","wear","fashion","jeans","jacket","skirt","hat","cap","cloth"],
        books: ["book","textbook","novel","study","note","pen","pencil","stationery","calculator"],
        room: ["mattress","foam","pillow","curtain","rug","lamp","fan","decoration","decor","mirror","room"],
      };

      // Expand keywords with category synonyms
      const expandedKeywords = new Set(keywords);
      for (const kw of keywords) {
        for (const [, synonyms] of Object.entries(CATEGORY_MAP)) {
          if (synonyms.includes(kw)) {
            synonyms.forEach((s) => expandedKeywords.add(s));
          }
        }
      }

      const scored = topRankedListings.map((listing: any) => {
        const titleAndCat = `${listing.title} ${listing.category}`.toLowerCase();
        const desc = String(listing.description || "").toLowerCase();
        let score = 0;
        for (const kw of expandedKeywords) {
          // Title/category match scores 4x more than description match
          if (titleAndCat.includes(kw)) score += 4;
          else if (desc.includes(kw)) score += 1;
        }
        return { listing, score };
      }).filter(({ score }: { score: number }) => score >= 4) // Must match title or category
        .sort((a: any, b: any) => b.score - a.score);

      for (const { listing } of scored.slice(0, 6)) {
        selectedListings.push(listing);
      }

      // If still nothing, show top listings but only when user explicitly asked for products
      if (selectedListings.length === 0 && /show|browse|all|available|marketplace|what.*sell|what.*buy/.test(message.toLowerCase()) && topRankedListings.length > 0) {
        for (const listing of topRankedListings.slice(0, 4)) {
          selectedListings.push(listing);
        }
      }
    }

    const recommendedItems = selectedListings.map((listing: any) => ({
      id: String(listing.id || ""),
      title: String(listing.title || ""),
      description: String(listing.description || ""),
      price: Math.max(0, toSafeNumber(listing.price, 0)),
      category: String(listing.category || ""),
      type: listing.type === "rent" ? "rent" : "sell",
      image: Array.isArray(listing.images) ? (listing.images[0] || "") : "",
      location: String(listing.location || listing?.seller?.university || ""),
      seller: {
        id: String(listing?.seller?.id || ""),
        name: String(listing?.seller?.name || "Unknown seller"),
        university: String(listing?.seller?.university || ""),
        rating: Math.max(0, toSafeNumber(listing?.seller?.rating, 0)),
      },
      reason: normalizeAiText(reasonsMap?.[listing.id], 300) || buildDefaultRecommendationReason(listing),
    }));

    const intent = rawIntent || "general_qa";

    const assistantMessage = normalizeAiText(
      parsedModel?.assistant_message,
      6000,
    ) || fallbackPlainReply || buildFallbackAssistantMessage(recommendedItems.length, intent);

    const nextQuestions = Array.isArray(parsedModel?.next_questions)
      ? parsedModel.next_questions
        .map((value: unknown) => normalizeAiText(value, 250))
        .filter(Boolean)
        .slice(0, 4)
      : [];
    const stylePlan =
      parsedModel?.style_plan && typeof parsedModel.style_plan === "object" ? parsedModel.style_plan : null;
    const kitchenList =
      parsedModel?.kitchen_list && typeof parsedModel.kitchen_list === "object" ? parsedModel.kitchen_list : null;
    const budgetBreakdown =
      parsedModel?.budget_breakdown && typeof parsedModel.budget_breakdown === "object"
        ? parsedModel.budget_breakdown
        : null;

    const styleFromModel = normalizeAiText((stylePlan as any)?.style, 80);
    const styleFromMessage = detectStyleFromText(message);
    const nextPreferences = mergeAiPreferences(savedPreferences, {
      budgetMin: budgetFromMessage?.min,
      budgetMax: budgetFromMessage?.max,
      preferredStyle: styleFromModel || styleFromMessage || savedPreferences.preferredStyle,
      preferredCity: effectiveLocation.city || savedPreferences.preferredCity,
      preferredUniversity: effectiveLocation.university || savedPreferences.preferredUniversity,
      lastIntent: intent,
    });

    const now = new Date().toISOString();
    const updatedHistory = normalizeAiHistoryEntries([
      ...activeHistory,
      {
        id: createEntityId("AIMSG"),
        role: "user",
        content: message,
        createdAt: now,
      },
      {
        id: createEntityId("AIMSG"),
        role: "assistant",
        content: assistantMessage,
        createdAt: now,
      },
    ]);

    const activeConversationId = user
      ? (
        selectedConversation?.id ||
        requestedConversationId ||
        createEntityId("AITHR")
      )
      : "";

    const updatedConversation = user
      ? {
        id: activeConversationId,
        title: normalizeAiConversationTitle(requestedConversationTitle, updatedHistory),
        createdAt: selectedConversation?.createdAt || now,
        updatedAt: now,
        messages: updatedHistory,
      }
      : null;

    const conversations = user && updatedConversation
      ? upsertAiConversation(storedConversations, updatedConversation)
      : [];

    if (user) {
      await kv.set(aiChatConversationsKey(user.id), conversations);
      await kv.set(aiChatHistoryKey(user.id), updatedHistory);
      await kv.set(aiPreferenceKey(user.id), nextPreferences);
    }

    return c.json({
      success: true,
      intent,
      assistantMessage,
      recommendedItems,
      stylePlan,
      kitchenList,
      budgetBreakdown,
      nextQuestions,
      messages: updatedHistory,
      conversationId: activeConversationId,
      activeConversationId,
      conversations,
      preferences: nextPreferences,
      usage: usageSnapshot ? toPublicAiUsageSnapshot(usageSnapshot) : null,
      metadata: {
        model:
          normalizeAiText(modelResponse?.model, 160) ||
          getModelNameForProvider(getPreferredAiProviderOrder()[0] || "openai"),
        source: modelResponse.ok ? (normalizeAiText(modelResponse?.provider, 60) || "openai") : "fallback",
        warning: modelResponse.ok ? "" : modelResponse.message || "",
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return c.json(
      {
        error: "Failed to process AI chat request",
        usage: usageSnapshot ? toPublicAiUsageSnapshot(usageSnapshot) : null,
      },
      500,
    );
  }
});


// ============ IMAGE UPLOAD ROUTES ============

app.get("/make-server-50b25a4f/files/:id", async (c) => {
  try {
    const fileId = c.req.param("id");
    const storedFile = await kv.get(storedFileKey(fileId));

    if (!storedFile?.dataBase64 || typeof storedFile.contentType !== "string") {
      return c.json({ error: "File not found" }, 404);
    }

    const fileBytes = Buffer.from(String(storedFile.dataBase64), "base64");
    const fileName = sanitizeFileName(storedFile.originalName);

    return new Response(fileBytes, {
      headers: {
        "Content-Type": storedFile.contentType,
        "Content-Length": String(fileBytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("File read error:", error);
    return c.json({ error: "Failed to load file" }, 500);
  }
});

// Upload image
app.post("/make-server-50b25a4f/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const rawType = formData.get('type');
    const type = typeof rawType === 'string' ? rawType.trim().toLowerCase() : 'listing';
    const user = await verifyAuth(c.req.header('Authorization'));
    const isProfileUpload = type === 'profile';
    const isDeliveryProofUpload = type === 'delivery-proof' || type === 'proof';
    const allowAnonymousUpload = isProfileUpload && !user;

    if (!user && !allowAnonymousUpload) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file size (max 5MB)
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return c.json({ error: 'File size must be less than 5MB' }, 400);
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return c.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, 400);
    }

    const uploaderId = user?.id || `signup-${crypto.randomUUID()}`;
    const fileId = createEntityId("FILE");
    const fileBuffer = await file.arrayBuffer();
    const storedFile = {
      id: fileId,
      ownerId: uploaderId,
      category: isProfileUpload ? "profile" : (isDeliveryProofUpload ? "delivery-proof" : "listing"),
      originalName: sanitizeFileName(file.name),
      contentType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      dataBase64: Buffer.from(fileBuffer).toString("base64"),
    };

    await kv.set(storedFileKey(fileId), storedFile);

    return c.json({ 
      success: true, 
      url: buildStoredFileUrl(c.req.raw, fileId),
      path: fileId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

// ── WebSocket real-time hub ─────────────────────────────────────────────────
// Maps userId → Set of open WebSocket connections for that user.
// Used to push new messages (including call signals) in real-time so the
// frontend doesn't have to rely on 800ms HTTP polling for signaling.
const wsClients = new Map<string, Set<WebSocket>>();

function wsBroadcastToUser(userId: string, payload: unknown) {
  const sockets = wsClients.get(userId);
  if (!sockets) return;
  const data = JSON.stringify(payload);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(data); } catch { /* ignore closed socket */ }
    }
  });
}

app.get("/make-server-50b25a4f/messages/ws", async (c) => {
  const rawToken = c.req.query("token") || c.req.header("Authorization")?.replace(/^bearer\s+/i, "") || "";
  const user = await verifyMessagingAuth(`Bearer ${rawToken}`, rawToken);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Deno native WebSocket upgrade (only available on Deno runtime).
  const denoGlobal = globalThis as any;
  if (typeof denoGlobal?.Deno?.upgradeWebSocket !== "function") {
    return c.json({ error: "WebSocket not supported in this runtime" }, 501);
  }

  const { socket, response } = denoGlobal.Deno.upgradeWebSocket(c.req.raw);

  if (!wsClients.has(user.id)) wsClients.set(user.id, new Set());
  wsClients.get(user.id)!.add(socket);

  socket.onclose = () => {
    const set = wsClients.get(user.id);
    if (set) { set.delete(socket); if (set.size === 0) wsClients.delete(user.id); }
  };

  socket.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(String(event.data));
      // Relay typing / read-receipt events to the conversation partner.
      if ((data.type === "typing_start" || data.type === "typing_end") && data.conversationId) {
        wsBroadcastToUser(data.conversationId, { ...data, userId: user.id });
      }
      if (data.type === "message_read" && data.conversationId) {
        wsBroadcastToUser(data.conversationId, { ...data, userId: user.id });
      }
    } catch { /* ignore malformed frames */ }
  };

  socket.onerror = () => {
    const set = wsClients.get(user.id);
    if (set) { set.delete(socket); if (set.size === 0) wsClients.delete(user.id); }
  };

  return response;
});
// ────────────────────────────────────────────────────────────────────────────

const serverPort = Math.max(1, toSafeNumber(Deno.env.get("PORT"), 8000));
const isDenoDeployRuntime = Boolean((Deno.env.get("DENO_DEPLOYMENT_ID") || "").trim());

async function isHealthEndpointReachable(port: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/make-server-50b25a4f/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    return payload?.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function startServer() {
  if (isDenoDeployRuntime) {
    console.log("Server running on Deno Deploy runtime");
    Deno.serve(app.fetch);
    return;
  }

  console.log(`Server listening on port ${serverPort}`);
  try {
    Deno.serve({ port: serverPort }, app.fetch);
  } catch (error) {
    if (error instanceof Deno.errors.AddrInUse) {
      const alreadyRunning = await isHealthEndpointReachable(serverPort);
      if (alreadyRunning) {
        console.log(`Server is already running on port ${serverPort}. Reusing existing instance.`);
        return;
      }
      console.error(`Port ${serverPort} is already in use by another process.`);
      Deno.exit(1);
    }
    throw error;
  }
}

// In Deno with Node compatibility enabled, `process` can exist.
// Use native Deno version detection to decide whether to auto-start.
const shouldStartDenoServer = Boolean((Deno as any)?.version?.deno);

if (shouldStartDenoServer) {
  await startServer();

  // Keep-alive: ping own health endpoint every 10 min so Render free tier
  // never spins the server down while it is in use.
  setInterval(() => {
    fetch(`http://localhost:${serverPort}/make-server-50b25a4f/health`).catch(() => {});
  }, 10 * 60 * 1000);
}

export { app };
export default app;
