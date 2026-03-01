import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase clients
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize storage buckets
async function initializeBuckets() {
  const buckets = ['make-50b25a4f-listings', 'make-50b25a4f-profiles', 'make-50b25a4f-delivery-proofs'];
  
  for (const bucketName of buckets) {
    const { data: bucketsList } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = bucketsList?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 5242880, // 5MB
      });
      console.log(`Created bucket: ${bucketName}`);
    }
  }
}

// Initialize buckets on startup
initializeBuckets().catch(console.error);

// Helper function to create admin user on startup
async function createAdminUser() {
  const adminEmail = Deno.env.get('ADMIN_EMAIL');
  const adminPassword = Deno.env.get('ADMIN_PASSWORD');

  if (!adminEmail || !adminPassword) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
    return;
  }

  // Check if user already exists by fetching the default list of users (up to 50)
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError.message);
    // Decide if we should stop here or try to create anyway
    // For now, we'll log the error and continue, the createUser will fail if user exists
  }

  const adminExists = users?.some(user => user.email === adminEmail);

  if (adminExists) {
    console.log('Admin user already exists');
    return;
  }

  // Create admin user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true, // Auto-confirm admin email
  });

  if (error) {
    console.error('Error creating admin user:', error.message);
    return;
  }

  // Create admin profile in KV store
  const userProfile = {
    id: data.user.id,
    name: 'Admin',
    email: adminEmail,
    phone: '000000000',
    university: 'CampusMarket',
    studentId: '',
    rating: 0,
    reviewCount: 0,
    isVerified: true,
    isApproved: true,
    role: 'admin',
    userType: 'seller',
    profilePicture: '',
    avatar: '',
    isBanned: false,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`user:${data.user.id}`, userProfile);
  await kv.set(`wallet:${data.user.id}`, {
    userId: data.user.id,
    availableBalance: 0,
    pendingBalance: 0,
    updatedAt: new Date().toISOString(),
  });
  console.log('Admin user created successfully');
}

// Create admin user on startup
createAdminUser().catch(console.error);

function normalizeUserProfile(profile: any) {
  if (!profile || typeof profile !== 'object') {
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

  const profilePicture =
    typeof normalized.profilePicture === 'string'
      ? normalized.profilePicture
      : (typeof normalized.avatar === 'string' ? normalized.avatar : '');

  normalized.profilePicture = profilePicture;
  normalized.avatar = profilePicture;
  normalized.isBanned = typeof normalized.isBanned === 'boolean' ? normalized.isBanned : false;

  return normalized;
}

const DEFAULT_ADMIN_SETTINGS = {
  platformName: "CampusMarket",
  supportEmail: "support@campusmarket.cm",
  maintenanceMode: false,
  allowNewRegistrations: true,
  platformCommissionPercent: 5,
  payoutFeePercent: 5,
  minimumPayoutAmount: 1000,
  autoPayoutToMobileMoney: true,
  updatedAt: "",
};

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

const toSafeNumber = (value: any, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const roundMoney = (value: any) => {
  const safeValue = toSafeNumber(value, 0);
  return Math.round((safeValue + Number.EPSILON) * 100) / 100;
};

const CAMEROON_GEO_BOUNDS = {
  minLat: 1.6,
  maxLat: 13.2,
  minLng: 8.4,
  maxLng: 16.3,
};

const ALLOWED_PICKUP_LOCATIONS = [
  { name: "University of Yaounde I", lat: 3.848, lng: 11.502, type: "campus" },
  { name: "University of Douala", lat: 4.053, lng: 9.704, type: "campus" },
  { name: "Ngoa Ekelle", lat: 3.864, lng: 11.5, type: "roundabout" },
  { name: "Bonamoussadi Roundabout", lat: 4.088, lng: 9.758, type: "roundabout" },
  { name: "Bambili Campus", lat: 5.959, lng: 10.197, type: "campus" },
];

const ALLOWED_PICKUP_KEYWORDS = [
  "university",
  "campus",
  "roundabout",
  "ngoa ekelle",
  "bonamoussadi",
  "bambili",
  "yaounde",
  "douala",
];

const ORDER_STATUS = {
  PAID_PENDING_DELIVERY: "paid_pending_delivery",
  DELIVERED_RELEASED: "delivered_released",
  REFUNDED: "refunded",
} as const;

const ESCROW_STATUS = {
  PENDING: "pending",
  RELEASED: "released",
  REFUNDED: "refunded",
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

const normalizeOrderStatusLabel = (status: string) => {
  if (status === ORDER_STATUS.PAID_PENDING_DELIVERY) return "PAID - PENDING DELIVERY";
  if (status === ORDER_STATUS.DELIVERED_RELEASED) return "DELIVERED - RELEASED";
  if (status === ORDER_STATUS.REFUNDED) return "REFUNDED";
  return status;
};

const PAYMENT_PROVIDER_MODE = (Deno.env.get("PAYMENT_PROVIDER_MODE") || (Deno.env.get("CAMPAY_APP_ID") ? "campay" : "mock")).toLowerCase();
const CAMPAY_BASE_URL = (Deno.env.get("CAMPAY_BASE_URL") || "https://demo.campay.net/api").replace(/\/+$/, "");
const CAMPAY_TOKEN_URL = Deno.env.get("CAMPAY_TOKEN_URL") || `${CAMPAY_BASE_URL}/token/`;
const CAMPAY_COLLECTION_URL = Deno.env.get("CAMPAY_COLLECTION_URL") || `${CAMPAY_BASE_URL}/collect/`;
const CAMPAY_DISBURSE_URL = Deno.env.get("CAMPAY_DISBURSE_URL") || `${CAMPAY_BASE_URL}/withdraw/`;
const CAMPAY_AUTH_SCHEME = Deno.env.get("CAMPAY_AUTH_SCHEME") || "Token";
const CAMPAY_FORCE_MOCK = (Deno.env.get("CAMPAY_FORCE_MOCK") || "").toLowerCase() === "true";
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

let cachedCampayToken = "";
let cachedCampayTokenExpiry = 0;

const formatCameroonPhoneE164 = (phone: string) => {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith("237")) {
    return `+${normalized}`;
  }
  return `+237${normalized}`;
};

const shouldUseMockProvider = () =>
  CAMPAY_FORCE_MOCK || PAYMENT_PROVIDER_MODE !== "campay";

const calculateTransactionFee = (amount: number) =>
  roundMoney((roundMoney(amount) * TRANSACTION_FEE_PERCENT) / 100 + TRANSACTION_FEE_FLAT);

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

async function getCampayAccessToken() {
  const staticToken = Deno.env.get("CAMPAY_ACCESS_TOKEN");
  if (staticToken && staticToken.trim().length > 0) {
    return staticToken.trim();
  }

  if (cachedCampayToken && Date.now() < cachedCampayTokenExpiry) {
    return cachedCampayToken;
  }

  const username = Deno.env.get("CAMPAY_APP_USERNAME");
  const password = Deno.env.get("CAMPAY_APP_PASSWORD");
  const appId = Deno.env.get("CAMPAY_APP_ID");

  if (!username || !password) {
    throw new Error("CamPay credentials are missing");
  }

  const tokenPayload: Record<string, string> = {
    username,
    password,
  };
  if (appId) {
    tokenPayload.app_id = appId;
  }

  const tokenResponse = await fetch(CAMPAY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokenPayload),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok) {
    throw new Error(tokenData?.error || tokenData?.message || "Failed to authenticate with CamPay");
  }

  const token = tokenData?.token || tokenData?.access_token || tokenData?.accessToken;
  if (!token || typeof token !== "string") {
    throw new Error("CamPay token was not returned");
  }

  cachedCampayToken = token;
  cachedCampayTokenExpiry = Date.now() + (45 * 60 * 1000);
  return token;
}

async function callCampay(endpoint: string, payload: Record<string, any>) {
  const token = await getCampayAccessToken();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${CAMPAY_AUTH_SCHEME} ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `CamPay API error (${response.status})`);
  }

  return data;
}

async function processInboundMobileMoneyPayment(params: {
  amount: number;
  phoneNumber: string;
  provider: "mtn-momo" | "orange-money";
  reference: string;
  description: string;
}) {
  if (shouldUseMockProvider()) {
    return {
      provider: "mock",
      status: "successful",
      reference: `MOCK-PAY-${Date.now()}`,
      raw: { simulated: true },
    };
  }

  const data = await callCampay(CAMPAY_COLLECTION_URL, {
    amount: roundMoney(params.amount),
    from: formatCameroonPhoneE164(params.phoneNumber),
    description: params.description,
    external_reference: params.reference,
    method: params.provider,
    channel: params.provider === "orange-money" ? "orange" : "mtn",
  });

  const status = String(
    data?.status || data?.transaction_status || data?.payment_status || "pending",
  ).toLowerCase();
  const providerReference = String(
    data?.reference ||
    data?.transaction_reference ||
    data?.operator_reference ||
    params.reference,
  );

  const acceptedStatuses = new Set(["pending", "accepted", "successful", "success", "completed"]);
  if (!acceptedStatuses.has(status) && !providerReference) {
    throw new Error(data?.message || "Payment request was not accepted by CamPay");
  }

  return {
    provider: "campay",
    status,
    reference: providerReference,
    raw: data,
  };
}

async function processOutboundMobileMoneyPayout(params: {
  amount: number;
  phoneNumber: string;
  provider: "mtn-momo" | "orange-money";
  reference: string;
  description: string;
}) {
  if (shouldUseMockProvider()) {
    return {
      provider: "mock",
      status: "successful",
      reference: `MOCK-WD-${Date.now()}`,
      raw: { simulated: true },
    };
  }

  const data = await callCampay(CAMPAY_DISBURSE_URL, {
    amount: roundMoney(params.amount),
    to: formatCameroonPhoneE164(params.phoneNumber),
    description: params.description,
    external_reference: params.reference,
    method: params.provider,
    channel: params.provider === "orange-money" ? "orange" : "mtn",
  });

  const status = String(
    data?.status || data?.transaction_status || data?.payout_status || "pending",
  ).toLowerCase();
  const providerReference = String(
    data?.reference ||
    data?.transaction_reference ||
    data?.operator_reference ||
    params.reference,
  );

  const acceptedStatuses = new Set(["pending", "accepted", "successful", "success", "completed"]);
  if (!acceptedStatuses.has(status) && !providerReference) {
    throw new Error(data?.message || "Payout request was not accepted by CamPay");
  }

  return {
    provider: "campay",
    status,
    reference: providerReference,
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
    transactionFee: roundMoney(order.transactionFee || 0),
    totalCharged: roundMoney(order.totalCharged || order.amount || 0),
    transactionRef: order.transactionRef,
    pickupDate: order.pickupDate,
    pickupTime: order.pickupTime,
    pickupLocation: order.pickupLocation,
    status: order.status,
    statusLabel: normalizeOrderStatusLabel(order.status),
    timestamp: order.createdAt,
    createdAt: order.createdAt,
    releasedAt: order.releasedAt || null,
    refundedAt: order.refundedAt || null,
  };
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

// Helper function to verify auth token
async function verifyAuth(authHeader: string | null | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
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

async function enrichListing(listing: any) {
  if (!listing || typeof listing !== 'object') {
    return listing;
  }

  const normalizedListing = {
    ...listing,
    views: Math.max(0, toSafeNumber(listing.views, 0)),
    likesCount: Math.max(0, toSafeNumber(listing.likesCount, 0)),
  };

  if (!normalizedListing.sellerId || typeof normalizedListing.sellerId !== 'string') {
    return normalizedListing;
  }

  const seller = await getUserProfile(normalizedListing.sellerId);
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

// Health check endpoint
app.get("/make-server-50b25a4f/health", (c) => {
  return c.json({ status: "ok" });
});

// ============ AUTHENTICATION ROUTES ============

// Sign up endpoint
app.post("/make-server-50b25a4f/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password, phone, university, studentId, userType, profilePicture } = body;
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

    if (!name || !email || !password || !phone || !university) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Create user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        phone,
        university,
        studentId,
        userType: normalizedUserType,
        profilePicture: normalizedProfilePicture,
      },
    });

    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    // Create user profile in KV store with pending approval
    const userProfile = {
      id: data.user.id,
      name,
      email,
      phone,
      university,
      studentId: studentId || '',
      rating: 0,
      reviewCount: 0,
      isVerified: false,
      isApproved: false, // Pending admin approval
      role: 'student',
      userType: normalizedUserType,
      profilePicture: normalizedProfilePicture,
      avatar: normalizedProfilePicture,
      isBanned: false,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${data.user.id}`, userProfile);
    await kv.set(`wallet:${data.user.id}`, {
      userId: data.user.id,
      availableBalance: 0,
      pendingBalance: 0,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ 
      success: true, 
      message: 'Account created! Please wait for admin approval before logging in.',
      userId: data.user.id
    });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'An error occurred during signup' }, 500);
  }
});

// Sign in endpoint
app.post("/make-server-50b25a4f/signin", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    // Use the anon client for sign in
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Get user profile
    const profile = await getUserProfile(data.user.id);
    
    if (!profile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    if (profile.isBanned) {
      return c.json({ error: 'Your account has been suspended. Contact support.' }, 403);
    }

    // Check if account is approved (unless admin)
    if (profile.role !== 'admin' && !profile.isApproved) {
      return c.json({ 
        error: 'Your account is pending admin approval. Please wait for approval before logging in.' 
      }, 403);
    }

    return c.json({ 
      success: true, 
      accessToken: data.session.access_token,
      user: profile
    });
  } catch (error) {
    console.error('Signin error:', error);
    return c.json({ error: 'An error occurred during signin' }, 500);
  }
});

// Get current user profile
app.get("/make-server-50b25a4f/auth/me", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
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
    const { name, phone, studentId, profilePicture } = body;

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

    await kv.set(`user:${user.id}`, profile);

    return c.json({ success: true, user: profile });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
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
    const listings = await kv.getByPrefix('listing:');
    const enriched = await Promise.all((listings || []).map(async (listing: any) => await enrichListing(listing)));
    return c.json({ listings: enriched || [] });
  } catch (error) {
    console.error('Get listings error:', error);
    return c.json({ error: 'Failed to get listings' }, 500);
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
    
    if (!listing) {
      return c.json({ error: 'Listing not found' }, 404);
    }

    // Increment views
    listing.views = (listing.views || 0) + 1;
    await kv.set(`listing:${id}`, listing);

    return c.json({ listing: await enrichListing(listing) });
  } catch (error) {
    console.error('Get listing error:', error);
    return c.json({ error: 'Failed to get listing' }, 500);
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
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { receiverId, content, itemId } = body;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const message = {
      id: messageId,
      senderId: user.id,
      receiverId,
      itemId,
      content,
      timestamp: new Date().toISOString(),
      read: false,
    };

    await kv.set(`message:${messageId}`, message);

    // Add to both users' message lists
    const senderMessages = await kv.get(`user:${user.id}:messages`) || [];
    senderMessages.push(messageId);
    await kv.set(`user:${user.id}:messages`, senderMessages);

    const receiverMessages = await kv.get(`user:${receiverId}:messages`) || [];
    receiverMessages.push(messageId);
    await kv.set(`user:${receiverId}:messages`, receiverMessages);

    return c.json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

// Get user's messages
app.get("/make-server-50b25a4f/messages", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const messageIds = await kv.get(`user:${user.id}:messages`) || [];
    const messages = await Promise.all(
      messageIds.map(async (id: string) => await kv.get(`message:${id}`))
    );

    return c.json({ messages: messages.filter(m => m !== null) });
  } catch (error) {
    console.error('Get messages error:', error);
    return c.json({ error: 'Failed to get messages' }, 500);
  }
});

// Mark message as read
app.put("/make-server-50b25a4f/messages/:id/read", async (c) => {
  const user = await verifyAuth(c.req.header('Authorization'));
  
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
  const user = await verifyAuth(c.req.header('Authorization'));

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
  const user = await verifyAuth(c.req.header('Authorization'));

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
  const user = await verifyAuth(c.req.header('Authorization'));

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const otherUserId = c.req.param('otherUserId');
    if (!otherUserId) {
      return c.json({ error: 'Conversation user is required' }, 400);
    }

    const messageIds = await kv.get(`user:${user.id}:messages`) || [];
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

  const settings = await getAdminSettings();
  const commissionPercent = Math.max(0, toSafeNumber(settings.platformCommissionPercent, DEFAULT_ADMIN_SETTINGS.platformCommissionPercent));
  const amount = roundMoney(listing.price);
  const transactionFee = calculateTransactionFee(amount);
  const totalCharged = roundMoney(amount + transactionFee);
  const platformFee = roundMoney((amount * commissionPercent) / 100);
  const sellerNetAmount = roundMoney(amount - platformFee);
  const orderId = createEntityId("ORD");
  const escrowId = createEntityId("ESC");
  const transactionRef = `${paymentMethod.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const paymentResult = await processInboundMobileMoneyPayment({
    amount: totalCharged,
    phoneNumber,
    provider: paymentMethod,
    reference: transactionRef,
    description: `Escrow payment for ${listing.title || "marketplace item"}`,
  });
  const now = new Date().toISOString();

  const escrowProviderSync = await syncEscrowProvider("hold", {
    escrowId,
    orderId,
    amount,
    transactionFee,
    totalCharged,
    platformFee,
    sellerNetAmount,
    currency: "XAF",
    buyerId: user.id,
    sellerId: listing.sellerId,
    paymentMethod,
    paymentReference: paymentResult.reference || transactionRef,
    pickupDate,
    pickupTime,
    pickupLocation,
  });

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
    merchantMoMoName: MERCHANT_MOMO_NAME,
    merchantMoMoNumber: MERCHANT_MOMO_NUMBER,
    status: ORDER_STATUS.PAID_PENDING_DELIVERY,
    statusLabel: normalizeOrderStatusLabel(ORDER_STATUS.PAID_PENDING_DELIVERY),
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
    escrowProvider: escrowProviderSync.provider,
    escrowProviderStatus: escrowProviderSync.status,
    escrowProviderReference: escrowProviderSync.reference,
    escrowProviderSynced: escrowProviderSync.synced,
    escrowProviderUpdatedAt: escrowProviderSync.syncedAt,
    escrowProviderMeta: escrowProviderSync,
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
    status: ESCROW_STATUS.PENDING,
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
      hold: escrowProviderSync,
      latest: escrowProviderSync,
      updatedAt: now,
    },
    created_at: now,
    updated_at: now,
  };

  await kv.set(`order:${orderId}`, order);
  await kv.set(`escrow:${escrowId}`, escrowTransaction);
  await kv.set(`transaction:${orderId}`, buildLegacyTransaction(order));

  if (transactionFee > 0) {
    await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: transactionFee });
  }
  await adjustWallet(listing.sellerId, { pendingDelta: amount });

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

  const listingTitle = listing.title || "your item";
  await createUserNotification(listing.sellerId, {
    type: "order_created",
    title: "New order received",
    message: `${buyerProfile.name || "A buyer"} placed an order for ${listingTitle}.`,
    priority: "high",
    data: {
      orderId,
      itemId,
      buyerId: user.id,
      buyerName: buyerProfile.name || "",
    },
  });
  await createUserNotification(user.id, {
    type: "order_paid",
    title: "Payment received in escrow",
    message: `Your payment for ${listingTitle} is secured. Wait for seller delivery proof.`,
    priority: "normal",
    data: {
      orderId,
      itemId,
      sellerId: listing.sellerId,
      sellerName: sellerProfile.name || "",
    },
  });

  return { order, escrowTransaction };
}

async function releaseEscrowOrder(order: any, actorId: string) {
  const escrow = await kv.get(`escrow:${order.escrowId}`);
  if (!escrow || escrow.status !== ESCROW_STATUS.PENDING) {
    throw new Error("Escrow is not pending");
  }

  const settings = await getAdminSettings();
  const amount = roundMoney(order.amount);
  const platformFee = roundMoney(order.platformFee);
  const sellerNetAmount = roundMoney(amount - platformFee);
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

  // Optional auto payout to seller mobile money when escrow is released.
  if (
    settings.autoPayoutToMobileMoney &&
    updatedOrder.paymentMethod === "mtn-momo"
  ) {
    const sellerProfile = await getUserProfile(updatedOrder.sellerId);
    const sellerPhone = sellerProfile?.phone || "";
    if (isValidCameroonPhone(sellerPhone)) {
      const withdrawalId = createEntityId("WD");
      const availableWallet = await getWallet(updatedOrder.sellerId);
      const payoutAmount = roundMoney(sellerNetAmount);
      if (availableWallet.availableBalance >= payoutAmount && payoutAmount > 0) {
        const payoutReference = `AUTO-MTN-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        try {
          const payoutResult = await processOutboundMobileMoneyPayout({
            amount: payoutAmount,
            phoneNumber: sellerPhone,
            provider: "mtn-momo",
            reference: payoutReference,
            description: `Automatic escrow release payout for order ${updatedOrder.id}`,
          });
          await adjustWallet(updatedOrder.sellerId, { availableDelta: -payoutAmount });
          const autoWithdrawal = {
            id: withdrawalId,
            userId: updatedOrder.sellerId,
            amount: payoutAmount,
            provider: "mtn-momo",
            phoneNumber: sellerPhone,
            status: WITHDRAWAL_STATUS.COMPLETED,
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
          const sellerWithdrawals = (await kv.get(`user:${updatedOrder.sellerId}:withdrawals`)) || [];
          sellerWithdrawals.push(withdrawalId);
          await kv.set(`user:${updatedOrder.sellerId}:withdrawals`, sellerWithdrawals);
          updatedOrder.autoPayout = {
            provider: "mtn-momo",
            status: WITHDRAWAL_STATUS.COMPLETED,
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

  const amount = roundMoney(order.amount);
  const sellerCompensation = roundMoney(amount * 0.1);
  const buyerRefundAmount = roundMoney(amount - sellerCompensation);
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

  await adjustWallet(order.sellerId, { pendingDelta: -amount, availableDelta: sellerCompensation });
  await adjustWallet(order.buyerId, { availableDelta: buyerRefundAmount });

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
      sampleTotal: roundMoney(sampleAmount + sampleFee),
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
    const baseAmount = roundMoney(SUBSCRIPTION_PLAN_PRICING[userType][plan]);
    const transactionFee = calculateTransactionFee(baseAmount);
    const totalCharged = roundMoney(baseAmount + transactionFee);
    const reference = `SUB-${paymentMethod.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const paymentResult = await processInboundMobileMoneyPayment({
      amount: totalCharged,
      phoneNumber,
      provider: paymentMethod,
      reference,
      description: `${plan} ${userType} subscription`,
    });

    const now = new Date();
    const nowIso = now.toISOString();
    const endDate = new Date(now.getTime());
    if (plan === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

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
      subscriptionReference: paymentResult.reference || reference,
      subscriptionUpdatedAt: nowIso,
    };
    await kv.set(`user:${user.id}`, updatedProfile);

    await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: totalCharged });

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
      createdAt: nowIso,
    };
    await kv.set(`subscription_payment:${paymentId}`, paymentRecord);
    const paymentIds = (await kv.get(`user:${user.id}:subscriptionPayments`)) || [];
    paymentIds.push(paymentId);
    await kv.set(`user:${user.id}:subscriptionPayments`, paymentIds);

    return c.json({
      success: true,
      message: "Subscription activated successfully",
      user: updatedProfile,
      payment: paymentRecord,
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
        return {
          ...order,
          statusLabel: normalizeOrderStatusLabel(order.status),
          escrowStatus: escrow?.status || ESCROW_STATUS.PENDING,
          proofImageUrl: order.deliveryProofUrl || escrow?.proof_image_url || "",
          listingTitle: listing?.title || "Unknown Item",
          listingImage: listing?.images?.[0] || "",
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

// Get single order details
app.get("/make-server-50b25a4f/orders/:id", async (c) => {
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

    const profile = await getUserProfile(user.id);
    const isAdmin = profile?.role === "admin";
    const isBuyer = order.buyerId === user.id;
    const isSeller = order.sellerId === user.id;
    if (!isAdmin && !isBuyer && !isSeller) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const escrow = await kv.get(`escrow:${order.escrowId}`);
    const listing = await kv.get(`listing:${order.itemId}`);
    const seller = await getUserProfile(order.sellerId);
    const buyer = await getUserProfile(order.buyerId);
    const sellerWallet = await getWallet(order.sellerId);

    return c.json({
      order: {
        ...order,
        statusLabel: normalizeOrderStatusLabel(order.status),
      },
      escrow,
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
          order.status === ORDER_STATUS.PAID_PENDING_DELIVERY &&
          Boolean(order.sellerProofUploaded),
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

    const escrow = await kv.get(`escrow:${order.escrowId}`);
    if (escrow) {
      await kv.set(`escrow:${order.escrowId}`, {
        ...escrow,
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
    if (order.buyerId !== user.id) {
      return c.json({ error: "Only the buyer can confirm delivery" }, 403);
    }
    if (order.status !== ORDER_STATUS.PAID_PENDING_DELIVERY) {
      return c.json({ error: "Order is not awaiting confirmation" }, 400);
    }
    if (!order.sellerProofUploaded) {
      return c.json({ error: "Seller must upload delivery proof before buyer confirmation" }, 400);
    }

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
    const amount = roundMoney(body?.amount);
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

    await adjustWallet(user.id, { availableDelta: -amount });

    const withdrawal = {
      id: withdrawalId,
      userId: user.id,
      amount,
      provider,
      phoneNumber,
      status: WITHDRAWAL_STATUS.COMPLETED,
      reference: payoutResult.reference || payoutReference,
      providerStatus: payoutResult.status,
      providerName: payoutResult.provider,
      providerPayload: payoutResult.raw,
      note: "Payout to mobile money",
      createdAt: now,
      updatedAt: now,
      processedBy: "system",
    };

    await kv.set(`withdrawal:${withdrawalId}`, withdrawal);
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
    }

    return c.json({ success: true });
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
    
    const newFavorites = favorites.filter((id: string) => id !== itemId);
    await kv.set(`user:${user.id}:favorites`, newFavorites);

    return c.json({ success: true });
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

    return c.json({ favorites: favorites.filter(f => f !== null) });
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

    // Delete user profile
    await kv.del(`user:${userId}`);
    
    // Delete user from Supabase Auth
    await supabaseAdmin.auth.admin.deleteUser(userId);

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
    const orderTransactions = allOrders.map((order: any) => buildLegacyTransaction(order));
    const dedupedById = new Map<string, any>();
    [...orderTransactions, ...allTransactions]
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
app.get("/make-server-50b25a4f/admin/messages", async (c) => {
  const user = await verifyAuth(c.req.header("Authorization"));

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  try {
    const allMessages = await kv.getByPrefix("message:");
    const messages = (allMessages || [])
      .filter((msg: any) =>
        msg &&
        typeof msg === "object" &&
        typeof msg.id === "string" &&
        typeof msg.senderId === "string" &&
        typeof msg.receiverId === "string",
      )
      .sort((a: any, b: any) =>
        new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
      );

    const userIds = new Set<string>();
    for (const msg of messages) {
      userIds.add(msg.senderId);
      userIds.add(msg.receiverId);
    }

    const users = (await Promise.all(
      Array.from(userIds).map(async (id) => {
        try {
          return await getUserProfile(id);
        } catch (_error) {
          return null;
        }
      }),
    )).filter((u) => u !== null);

    return c.json({ messages, users });
  } catch (error) {
    console.error("Get admin messages error:", error);
    return c.json({ error: "Failed to get messages" }, 500);
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
    const amountToPay = Math.min(Math.max(0, requestedAmount), payout.pendingAmount);

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
    const payoutRecord = {
      id: payoutId,
      userId: sellerId,
      amount: roundMoney(amountToPay),
      provider: payoutProvider,
      phoneNumber: sellerPhone,
      status: WITHDRAWAL_STATUS.COMPLETED,
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
    // First, delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (authError) {
      // Still try to delete from KV even if auth deletion fails
      console.error(`Auth deletion failed for ${userIdToDelete}:`, authError.message);
    }

    // Then, delete from KV store
    await kv.del(`user:${userIdToDelete}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});


// ============ IMAGE UPLOAD ROUTES ============

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
    if (file.size > 5242880) {
      return c.json({ error: 'File size must be less than 5MB' }, 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, 400);
    }

    const bucketName = isProfileUpload
      ? 'make-50b25a4f-profiles'
      : (isDeliveryProofUpload ? 'make-50b25a4f-delivery-proofs' : 'make-50b25a4f-listings');
    const uploaderId = user?.id || `signup-${crypto.randomUUID()}`;
    const fileName = `${uploaderId}/${Date.now()}-${file.name}`;
    
    const fileBuffer = await file.arrayBuffer();
    
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return c.json({ error: 'Failed to upload file' }, 500);
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(data.path, 31536000);

    return c.json({ 
      success: true, 
      url: signedUrlData?.signedUrl,
      path: data.path
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

const serverPort = Math.max(1, toSafeNumber(Deno.env.get("PORT"), 8000));

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

await startServer();
