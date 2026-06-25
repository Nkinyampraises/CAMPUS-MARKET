# Payment, Escrow & Mobile‑Money Guide (Campus Market / UNITRADE)

> ⚠️ **OUTDATED PROVIDER.** The live integration migrated from **CamPay + manual USSD** to **Fapshi** (Direct Pay collection + Payout). The escrow/wallet/withdrawal *concepts* below are still accurate, but the provider-specific sections (CamPay tokens, `/collect/`, `/withdraw/`, USSD codes) no longer reflect the code. See **`docs/PAYMENT_SYSTEM_FAPSHI_GUIDE.md`** for the current integration.

A complete, practical guide to how money moves through this application — **escrow, CamPay, manual USSD/MoMo, wallets, and withdrawals** — how to get the API keys, how they are embedded and secured, and **how to rebuild the same system in any other project** (any language/stack).

> This document is reference material only. It does not change any code. All snippets are taken from or modeled on the real implementation in `server/index.ts` and `src/pages/PaymentReview.tsx`.

---

## 1. Overview & architecture

The payment system has **two independent layers**. Keep them separate in your head — it's the single most important idea.

```
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — MONEY MOVEMENT (real mobile money in/out of the platform)   │
│   • CamPay API     → collect (charge buyer) / withdraw (pay seller)   │
│   • Manual USSD    → buyer dials *126*9*<number>*<amount># themselves │
│   • NotchPay       → alternative push provider                        │
└──────────────────────────────────────────────────────────────────────┘
                               │  (records the payment)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 2 — ESCROW + WALLET LEDGER (internal accounting in the DB)      │
│   • Hold the seller's money as "pending" until the buyer confirms     │
│   • Release "pending → available" on confirmation                     │
│   • Refund path; platform fee → admin wallet                          │
│   • Withdrawals pay "available" balance back out via Layer 1          │
└──────────────────────────────────────────────────────────────────────┘
```

**Why escrow?** A marketplace can't just send the buyer's money straight to the seller — the buyer needs protection until they actually receive the item. Escrow means the platform **holds** the money, and only **releases** it to the seller once the buyer confirms delivery. If something goes wrong, the platform can **refund** instead.

**Mock vs live.** Layer 1 can run in **mock/simulation mode** (no real money, fake "success" responses) or **live mode** (real CamPay calls). The escrow ledger (Layer 2) works identically in both — that's what lets you demo the full flow with zero real money.

**Current state of this project:** it runs in **mock/simulation** because live CamPay collection requires a **registered business** (see §7). The code is fully built for live; only the credentials/flag need flipping.

### Money flow at a glance

```
Buyer pays ──▶ Platform MoMo (custody)            Seller wallet      Admin wallet
                                                  ───────────       ───────────
  POST /orders        item amount  ─────────────▶ pending +amount
                      transaction fee ───────────────────────────▶ available +fee
                                                  (order: PAID_PENDING_DELIVERY)

  Seller delivers + buyer confirms
  PUT /orders/:id/buyer-confirm                   pending  -amount
                                                  available +amount
                                                  (order: DELIVERED_RELEASED)

  Seller withdraws
  POST /wallet/withdrawals  ──▶ Seller MoMo        available -amount
```

---

## 2. Glossary

| Term | Meaning |
|------|---------|
| **Escrow** | Money held by the platform between purchase and delivery confirmation. |
| **Collect / charge** | Pull money **from** a customer's mobile‑money account (inbound). |
| **Disburse / withdraw / payout** | Send money **to** someone's mobile‑money account (outbound). |
| **Pending balance** | Money owed to a seller but not yet releasable (escrow held). |
| **Available balance** | Money a seller can withdraw right now (escrow released). |
| **USSD / MoMoPay** | Dialer codes like `*126*9*number*amount#` that move real money with no API. |
| **Transaction fee** | Platform revenue added on top of the item price (default **2%**). |
| **Provider mode** | `campay` (real API) or `mock` (simulated success). |
| **XAF / FCFA** | The currency (Central African CFA franc); amounts are whole numbers. |

---

## 3. End‑to‑end money lifecycle

Each step lists the **endpoint**, the **ledger change**, and the **status transition**. Code references are to `server/index.ts`.

### Step 1 — Buyer checks out and pays
- **Endpoint:** `POST /make-server-50b25a4f/orders` → `createEscrowOrderForBuyer()`
- Computes: `amount = item price`, `transactionFee = 2% (calculateTransactionFee)`, `totalCharged = amount + fee`.
- Takes payment via **USSD** (manual, trusted) or **CamPay collect** (`processInboundMobileMoneyPayment`).
- Creates an **order** (`status: PAID_PENDING_DELIVERY`) and an **escrow** record (`status: PENDING`).
- **Ledger:** seller wallet `pendingBalance += amount`; admin wallet `availableBalance += transactionFee`.
- Marks the listing `sold`/`rented`; notifies both parties.

### Step 2 — Seller proves delivery
- **Endpoint:** `PUT /make-server-50b25a4f/orders/:id/seller-proof`
- Seller uploads a delivery proof image; order flags `sellerProofUploaded = true`.

### Step 3 — Buyer confirms receipt → escrow releases
- **Endpoint:** `PUT /make-server-50b25a4f/orders/:id/buyer-confirm` → `releaseEscrowOrder()`
- **Ledger:** seller `pendingBalance -= amount`, `availableBalance += sellerNetAmount` (seller gets the **full item amount**; platform revenue already came from the buyer fee).
- **Status:** order → `DELIVERED_RELEASED`; escrow → `RELEASED`.
- If `autoPayoutToMobileMoney` is enabled in admin settings, the seller is **auto‑paid** to their MoMo via CamPay disburse immediately.

### Step 4 — Seller withdraws available balance
- **Endpoint:** `POST /make-server-50b25a4f/wallet/withdrawals`
- Calls `processOutboundMobileMoneyPayout()` (CamPay disburse or mock); **ledger:** `availableBalance -= amount`; writes a `withdrawal:` record.

### Step 5 — Refund (if needed)
- **Endpoint:** `POST /make-server-50b25a4f/orders/:id/refund` — reverses the hold instead of releasing.

### Step 6 — Public payment metadata
- **Endpoint:** `GET /make-server-50b25a4f/payment-meta` — returns only the **public** merchant number + fee schedule for the checkout UI. **No secrets** are ever exposed here.

---

## 4. CamPay integration (full code)

CamPay (https://campay.net) is the mobile‑money aggregator. You authenticate once for a token, then call `collect` (charge) and `withdraw` (payout).

### 4.1 Configuration & provider‑mode resolution

```ts
// server/index.ts — config
const REQUESTED_PAYMENT_PROVIDER_MODE = (Deno.env.get("PAYMENT_PROVIDER_MODE") || "").trim().toLowerCase();
const CAMPAY_APP_CREDENTIAL = (Deno.env.get("CAMPAY_APP_ID") || Deno.env.get("CAMPAY_API_KEY") || "").trim();
const CAMPAY_USERNAME = (Deno.env.get("CAMPAY_USERNAME") || Deno.env.get("CAMPAY_APP_USERNAME") || "").trim();
const CAMPAY_PASSWORD = (Deno.env.get("CAMPAY_PASSWORD") || Deno.env.get("CAMPAY_APP_PASSWORD") || "").trim();
const CAMPAY_HAS_REQUIRED_CREDENTIALS = Boolean(CAMPAY_APP_CREDENTIAL && CAMPAY_USERNAME && CAMPAY_PASSWORD);

// "campay" only if creds exist; otherwise "mock".
const PAYMENT_PROVIDER_MODE = (() => {
  if (REQUESTED_PAYMENT_PROVIDER_MODE === "mock") return "mock";
  return CAMPAY_HAS_REQUIRED_CREDENTIALS ? "campay" : "mock";
})();

const CAMPAY_BASE_URL       = (Deno.env.get("CAMPAY_BASE_URL") || "https://demo.campay.net/api").replace(/\/+$/, "");
const CAMPAY_TOKEN_URL      = Deno.env.get("CAMPAY_TOKEN_URL")      || `${CAMPAY_BASE_URL}/token/`;
const CAMPAY_COLLECTION_URL = Deno.env.get("CAMPAY_COLLECTION_URL") || `${CAMPAY_BASE_URL}/collect/`;
const CAMPAY_DISBURSE_URL   = Deno.env.get("CAMPAY_DISBURSE_URL")   || `${CAMPAY_BASE_URL}/withdraw/`;
const CAMPAY_AUTH_SCHEME    = Deno.env.get("CAMPAY_AUTH_SCHEME") || "Token";   // header is "Token <token>"
const CAMPAY_FORCE_MOCK     = (Deno.env.get("CAMPAY_FORCE_MOCK") || "").toLowerCase() === "true";

// Use the mock provider when forced, or when not fully configured for CamPay.
const shouldUseMockProvider = () => CAMPAY_FORCE_MOCK || PAYMENT_PROVIDER_MODE !== "campay";
```

- **Sandbox base URL:** `https://demo.campay.net/api`
- **Live base URL:** `https://campay.net/api`

### 4.2 Get an access token (cached)

```ts
let cachedCampayToken = "";
let cachedCampayTokenExpiry = 0;

async function getCampayAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedCampayToken && Date.now() < cachedCampayTokenExpiry) return cachedCampayToken;

  // Optional: a long‑lived permanent token from the CamPay dashboard.
  const staticToken = Deno.env.get("CAMPAY_ACCESS_TOKEN");
  if (!forceRefresh && staticToken?.trim()) return staticToken.trim();

  const res = await fetch(CAMPAY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CAMPAY_USERNAME, password: CAMPAY_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Failed to authenticate with CamPay (${res.status})`);

  const data = await res.json();
  const token = data?.token || data?.access_token;
  if (!token) throw new Error("CamPay token was not returned");

  cachedCampayToken = token;
  cachedCampayTokenExpiry = Date.now() + 44 * 60 * 1000; // refresh ~1 min before the 45‑min expiry
  return token;
}
```

### 4.3 Generic authenticated call (auto‑refresh on 401)

```ts
async function callCampay(endpoint: string, payload: Record<string, any>) {
  const send = async (token: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `${CAMPAY_AUTH_SCHEME} ${token}` },
      body: JSON.stringify(payload),
    });

  let res = await send(await getCampayAccessToken());
  if (res.status === 401) {
    cachedCampayToken = ""; cachedCampayTokenExpiry = 0;          // token expired → refresh once
    res = await send(await getCampayAccessToken({ forceRefresh: true }));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `CamPay API error (${res.status})`);
  return data;
}
```

### 4.4 Collect — charge the buyer (inbound)

```ts
async function processInboundMobileMoneyPayment({ amount, phoneNumber, provider, reference, description }) {
  if (shouldUseMockProvider()) {
    return { provider: "mock", status: "successful", reference: `MOCK-PAY-${Date.now()}`, raw: { simulated: true } };
  }
  const data = await callCampay(CAMPAY_COLLECTION_URL, {
    amount: Math.round(amount),
    from: formatCameroonPhoneE164(phoneNumber),     // "+2376XXXXXXXX"
    description,
    external_reference: reference,
    method: provider,                                // "mtn-momo" | "orange-money"
    channel: provider === "orange-money" ? "orange" : "mtn",
  });
  return { provider: "campay", status: String(data?.status || "pending").toLowerCase(),
           reference: String(data?.reference || reference), raw: data };
}
```

The buyer receives a **PIN prompt** on their phone; once they approve, CamPay confirms the payment (instantly or via webhook).

### 4.5 Disburse — pay the seller (outbound)

```ts
async function processOutboundMobileMoneyPayout({ amount, phoneNumber, provider, reference, description }) {
  if (shouldUseMockProvider()) {
    return { provider: "mock", status: "successful", reference: `MOCK-WD-${Date.now()}`, raw: { simulated: true } };
  }
  const data = await callCampay(CAMPAY_DISBURSE_URL, {
    amount: Math.round(amount),
    to: formatCameroonPhoneE164(phoneNumber),
    description,
    external_reference: reference,
    method: provider,
    channel: provider === "orange-money" ? "orange" : "mtn",
  });
  return { provider: "campay", status: String(data?.status || "pending").toLowerCase(),
           reference: String(data?.reference || reference), raw: data };
}
```

### 4.6 Webhook (provider → your server)

CamPay calls your webhook URL when a transaction's status changes. Store and verify it; never trust client‑reported success for real money.

```ts
// GET is a health check; POST receives the event.
const handleCampayWebhookPost = async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  const eventId = payload?.reference || payload?.external_reference || crypto.randomUUID();
  await kv.set(`campay:webhook:${eventId}`, { receivedAt: new Date().toISOString(), payload });
  // → look up the order by external_reference and reconcile its status here.
  return c.json({ status: "ok" });
};
```

> Configure the webhook URL and a signing secret (`CAMPAY_WEBHOOK_KEY` / `WEBHOOK_SECRET`) in the CamPay dashboard, then verify the signature before acting.

---

## 5. Manual USSD / MoMo flow (full code)

This is the **default checkout path** and the clever part: it moves **real money with no API and no business account**. The buyer simply dials a **MoMoPay USSD code** that sends money to the platform's own MoMo number.

- **MTN MoMo:** `*126*9*<merchantNumber>*<amount>#`
- **Orange Money:** `*150#`

### 5.1 Build the code and open the dialer (frontend)

```ts
// src/pages/PaymentReview.tsx
const ussdCode = useMemo(
  () => `*126*9*${String(paymentMeta.merchantNumber || '').replace(/[^\d]/g, '')}*${totalAmount}#`,
  [paymentMeta.merchantNumber, totalAmount],
);

// A QR that opens the dialer with the code pre‑filled (great for desktop → scan with phone).
const ussdQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`tel:${ussdCode}`)}`;

async function handleConfirm() {
  if (isMobileDevice()) {
    // Mobile: open the phone dialer pre‑filled — user taps CALL, enters PIN, money is sent.
    window.location.href = `tel:${ussdCode.replace('#', '%23')}`;  // %23 = URL‑encoded '#'
    return; // user completes on their phone, then taps again to finalise the order
  }
  // Desktop: show the code + QR so they can dial from their phone.
  setShowDesktopModal(true);
}
```

### 5.2 Record the order as "paid by USSD" (frontend → backend)

```ts
// After the buyer has dialed and paid, finalise the order:
const paymentPayload = {
  ...state.payload,
  paymentChannel: 'ussd',
  paymentReference: `USSD-${Date.now()}`,
  ussdCode,
};
await postWithAuthRetry(`${API_URL}/orders`, paymentPayload);
```

### 5.3 Backend trusts the USSD channel

```ts
// server/index.ts — createEscrowOrderForBuyer()
const paymentChannel = body?.paymentChannel === "ussd" ? "ussd" : "api";
if (paymentChannel === "ussd" && paymentMethod !== "mtn-momo") {
  throw new Error("USSD flow is available for MTN MoMo only");
}
const paymentResult = paymentChannel === "ussd"
  ? { provider: "ussd-manual", status: "successful",
      reference: providedPaymentReference || transactionRef,
      raw: { channel: "ussd", code: body?.ussdCode, merchantNumber: MERCHANT_MOMO_NUMBER, totalCharged } }
  : await processInboundMobileMoneyPayment({ amount: totalCharged, phoneNumber, provider: paymentMethod, /* … */ });
```

**Trade‑off (read this carefully):**
- ✅ Works for anyone with a personal/merchant MoMo number — **no business registration, no API approval**.
- ⚠️ The backend **trusts** that the USSD payment happened (it cannot verify it automatically). The money really does arrive in the platform MoMo account, but reconciliation is **manual** (check the MoMo statement). For a student/demo project this is acceptable; for production at scale, prefer the verified CamPay collect + webhook path.

---

## 6. Escrow + wallet ledger (full code)

This is Layer 2 — pure internal accounting. It never talks to a provider; it just tracks who is owed what.

### 6.1 Wallet record & the single mutation helper

```ts
// A wallet is one record per user: { userId, availableBalance, pendingBalance, updatedAt }
async function adjustWallet(userId, { availableDelta = 0, pendingDelta = 0 }) {
  const wallet = (await kv.get(`wallet:${userId}`)) || { userId, availableBalance: 0, pendingBalance: 0 };
  wallet.availableBalance = roundXafAmount(wallet.availableBalance + availableDelta);
  wallet.pendingBalance   = roundXafAmount(wallet.pendingBalance   + pendingDelta);
  wallet.updatedAt = new Date().toISOString();
  await kv.set(`wallet:${userId}`, wallet);
  return wallet;
}
```

### 6.2 Hold on purchase (inside `createEscrowOrderForBuyer`)

```ts
// Seller is owed the item amount, but it's locked until the buyer confirms.
await adjustWallet(listing.sellerId, { pendingDelta: amount });
// Platform keeps the transaction fee immediately.
// ADMIN_WALLET_USER_ID is an internal constant ("platform-admin-wallet"), not an env var.
if (transactionFee > 0) await adjustWallet(ADMIN_WALLET_USER_ID, { availableDelta: transactionFee });
// Order + escrow records are created with status PAID_PENDING_DELIVERY / PENDING.
```

### 6.3 Release on confirmation (inside `releaseEscrowOrder`)

```ts
// Move the seller's money from locked → spendable.
await adjustWallet(order.sellerId, { pendingDelta: -amount, availableDelta: sellerNetAmount });
// order → DELIVERED_RELEASED ; escrow → RELEASED
// (optional) auto‑payout to the seller's MoMo via processOutboundMobileMoneyPayout()
```

### 6.4 Optional external escrow provider

If you use a dedicated escrow API, the code mirrors each ledger action (`hold` / `release` / `refund`) to that provider via `callEscrowProvider()` / `syncEscrowProvider()`, gated by `ESCROW_API_KEY` + `ESCROW_API_BASE_URL`. It's optional — the internal ledger is the source of truth; the external sync is best‑effort unless `ESCROW_API_STRICT=true`.

---

## 7. How to get the API keys

### CamPay
1. Create an account at **https://www.campay.net** and sign in to the dashboard.
2. **Create an application** → it gives you **App Username**, **App Password**, and an **App ID**.
3. Copy the **permanent access token** if you prefer a static token (optional — the code can also fetch one from username/password).
4. **Sandbox** uses base URL `https://demo.campay.net/api` with test credentials — use this for development.
5. **Going live** requires a **registered business** (RCCM in Cameroon). CamPay grants live `collect`/`withdraw` only to verified businesses, because you're intermediating other people's money. A student without a business **cannot** get live collection keys — this is why this project ships in mock/USSD mode.

### NotchPay (alternative)
1. Sign up at **https://business.notchpay.co**.
2. Get your **Public Key** and **Hash/Secret Key** from the dashboard → set `NOTCHPAY_PUBLIC_KEY` and `NOTCHPAY_HASH_KEY`.

### MoMo merchant number (for USSD)
- For the `*126*9*number*amount#` flow you need an **MTN MoMoPay merchant code/number** (or, for small/demo use, a personal MoMo number). Set it as `MERCHANT_MOMO_NUMBER`. This is the account that **receives** buyers' payments.

---

## 8. How the keys are embedded & secured

- All secrets live in a **`.env` file at the project root**, loaded at server startup:
  - Deno: `deno task start` runs with `--env-file=.env`.
  - Node: the same vars are read from `process.env`.
  - In code: `Deno.env.get("CAMPAY_APP_ID")` etc., read **once at module load** in `server/index.ts`.
- **`.env` is git‑ignored** — never commit real keys. Use `.env.example` (with blank/placeholder values) to document required vars.
- **The frontend never receives secret keys.** The only payment data exposed to the browser is the **public** merchant number + fee schedule via `GET /payment-meta`. Charging/payout always happens **server‑side**.
- **Webhooks are verified** with `CAMPAY_WEBHOOK_KEY` / `WEBHOOK_SECRET` before any status change is trusted.
- On hosting (Vercel/Render), set the same variables in the platform's **Environment Variables** dashboard — not in the repo.

Example `.env` block (names only — fill with your own values):

```bash
# Provider selection
PAYMENT_PROVIDER_MODE=campay        # or "mock"
CAMPAY_FORCE_MOCK=false             # true = always simulate (no real money)

# CamPay credentials
CAMPAY_APP_ID=
CAMPAY_APP_USERNAME=
CAMPAY_APP_PASSWORD=
CAMPAY_ACCESS_TOKEN=                # optional permanent token
CAMPAY_BASE_URL=https://demo.campay.net/api    # live: https://campay.net/api
CAMPAY_AUTH_SCHEME=Token
CAMPAY_WEBHOOK_KEY=

# Platform MoMo (USSD receiver) + fees
MERCHANT_MOMO_NUMBER=
MERCHANT_MOMO_NAME=
TRANSACTION_FEE_PERCENT=2
TRANSACTION_FEE_FLAT=0
# Note: the platform fee wallet id is an internal constant ("platform-admin-wallet"),
# not an env var — no configuration needed.

# Optional external escrow provider
ESCROW_API_KEY=
ESCROW_API_BASE_URL=

# Webhook signing
WEBHOOK_SECRET=

# Optional: NotchPay
NOTCHPAY_PUBLIC_KEY=
NOTCHPAY_HASH_KEY=
```

---

## 9. Testing without real money (simulation)

You can exercise the **entire** purchase → escrow → release → withdraw flow with zero real money:

1. Set **`CAMPAY_FORCE_MOCK=true`** (or `PAYMENT_PROVIDER_MODE=mock`, or simply leave CamPay creds blank).
2. `shouldUseMockProvider()` becomes `true`, so `processInboundMobileMoneyPayment` and `processOutboundMobileMoneyPayout` return `{ status: "successful", reference: "MOCK-…" }` **without calling CamPay**.
3. Place an order → check the seller wallet shows `pendingBalance` and the admin wallet shows the fee.
4. Upload seller proof → buyer‑confirm → check `pending` moved to `available`.
5. Withdraw → check `available` decreases and a `withdrawal:` record is created.

The ledger math is identical to live; only the provider calls are stubbed. This is the recommended mode for demos and final‑year project defenses.

---

## 10. Going‑live checklist

- [ ] Register a business and complete CamPay verification (RCCM, etc.).
- [ ] Obtain **live** CamPay credentials.
- [ ] Set `CAMPAY_BASE_URL=https://campay.net/api`.
- [ ] Set `CAMPAY_FORCE_MOCK=false` and `PAYMENT_PROVIDER_MODE=campay`.
- [ ] Set `MERCHANT_MOMO_NUMBER` to the business's receiving number.
- [ ] Configure the **webhook URL** + secret in the CamPay dashboard; verify signatures.
- [ ] Run **one small real transaction** end‑to‑end (collect → release → withdraw) before launch.
- [ ] Keep secrets only in the host's env dashboard; rotate any key that was ever committed.

---

## 11. Adapt this to YOUR own project (portable blueprint)

The exact same pattern works in **any** stack (Node/Express, Django, Laravel, Spring, …) and with **any** provider (CamPay, Fapshi, Flutterwave, Paystack, Stripe). Build these five pieces:

**1. Environment config.** One place that reads provider keys + a `FORCE_MOCK` flag and exposes a `shouldUseMock()` helper. Never hardcode keys.

**2. A thin provider wrapper** with three functions, each with a mock branch:
```ts
getToken()                          // auth (skip if the provider uses a static key)
charge({ amount, customer, ref })   // inbound / collect
payout({ amount, recipient, ref })  // outbound / disburse
// each: if (shouldUseMock()) return { status: "successful", reference: "MOCK-…" };
```
Swapping providers = rewriting only this file (the URLs, payload field names, and auth header). Everything else stays.

**3. An internal ledger** (a `wallets` table/collection with `available` + `pending`, mutated only through one `adjustWallet(userId, {availableDelta, pendingDelta})` function). The ledger — **not the provider** — is your source of truth.

**4. An order state machine:**
```
CREATED ─charge ok─▶ PAID_PENDING_DELIVERY ─seller proof─▶ (await buyer)
        ─buyer confirm─▶ RELEASED        (pending→available for seller)
        ─dispute/cancel─▶ REFUNDED       (reverse the hold)
```
Apply ledger deltas at each transition exactly as in §6.

**5. Webhook reconciliation + security.** For real money, **never** trust the client. The browser only *requests* a charge; the **provider's webhook** (verified by signature) is what flips an order to "paid". Keep secret keys server‑side; expose only public metadata to the UI.

**Provider‑swap cheat sheet** (same wrapper shape, different field names):

| Concept | CamPay | Flutterwave | Paystack | Stripe |
|--------|--------|-------------|----------|--------|
| Charge | `POST /collect/` | `POST /charges` | `POST /charge` | `PaymentIntents` |
| Payout | `POST /withdraw/` | `POST /transfers` | `POST /transfer` | `Payouts/Transfers` |
| Auth | `Token <token>` | `Bearer <secret>` | `Bearer <secret>` | `Bearer <secret>` |
| Confirm | webhook | webhook | webhook | webhook |

If you only have personal mobile money (no business), implement the **USSD fallback** from §5 instead of `charge()` — it needs no API approval, at the cost of manual reconciliation.

---

## 12. Reference tables

### Payment endpoints (`/make-server-50b25a4f/…`)

| Method & path | Purpose |
|---------------|---------|
| `GET  /payment-meta` | Public merchant number + fee schedule for the checkout UI. |
| `POST /orders` | Create an escrow order (charges buyer via USSD or CamPay). |
| `GET  /orders` · `GET /orders/:id` | List / fetch orders. |
| `PUT  /orders/:id/seller-proof` | Seller uploads delivery proof. |
| `PUT  /orders/:id/buyer-confirm` | Buyer confirms → release escrow to seller. |
| `POST /orders/:id/refund` | Refund the buyer (reverse the hold). |
| `GET  /wallet` | Seller wallet (available + pending). |
| `GET  /wallet/withdrawals` · `POST /wallet/withdrawals` | List / request a payout to MoMo. |
| `POST /payment/notchpay/charge` · `POST /payment/notchpay/callback` | NotchPay push payment + callback. |
| `GET`/`POST /campay/webhook` | CamPay transaction status webhook (also registered with the `/make-server-50b25a4f` prefix). |

### Payment environment variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `PAYMENT_PROVIDER_MODE` | `campay` or `mock`. | auto | No |
| `CAMPAY_FORCE_MOCK` | `true` = always simulate. | `false` | No |
| `CAMPAY_APP_ID` / `CAMPAY_API_KEY` | CamPay application id. | — | For live |
| `CAMPAY_APP_USERNAME` / `CAMPAY_USERNAME` | CamPay app username. | — | For live |
| `CAMPAY_APP_PASSWORD` / `CAMPAY_PASSWORD` | CamPay app password. | — | For live |
| `CAMPAY_ACCESS_TOKEN` | Static permanent token (optional). | — | No |
| `CAMPAY_BASE_URL` | API base. | `https://demo.campay.net/api` | No |
| `CAMPAY_AUTH_SCHEME` | Auth header scheme. | `Token` | No |
| `CAMPAY_WEBHOOK_KEY` | Webhook verification key. | — | For live |
| `MERCHANT_MOMO_NUMBER` | Platform MoMo number (USSD receiver). | `671562474`* | Yes |
| `MERCHANT_MOMO_NAME` | Display name for the merchant. | — | No |
| `TRANSACTION_FEE_PERCENT` | Platform fee %. | `2` | No |
| `TRANSACTION_FEE_FLAT` | Flat fee added. | `0` | No |
| `ESCROW_API_KEY` / `ESCROW_API_BASE_URL` | Optional external escrow provider. | — | No |
| `ESCROW_API_STRICT` | Fail the order if escrow sync fails. | `false` | No |
| `WEBHOOK_SECRET` | Generic webhook signing secret. | — | For live |
| `NOTCHPAY_PUBLIC_KEY` / `NOTCHPAY_HASH_KEY` | NotchPay credentials. | — | No |

\* The default is a placeholder — **always set your own** merchant number in production.

---

### TL;DR
- **Two layers:** a provider (CamPay/USSD/NotchPay) moves real money; an internal **ledger** holds it in escrow (`pending` → `available`).
- **CamPay** = automated collect/payout (needs a registered business for live). **USSD** = `*126*9*number*amount#`, works with no API but is manually reconciled. **Mock mode** simulates everything for demos.
- **Keys** live in `.env`, are read server‑side via `Deno.env.get`, are never sent to the browser, and webhooks are signature‑verified.
- To **reuse this anywhere:** env config → provider wrapper (charge/payout, with a mock branch) → ledger (`adjustWallet`) → order state machine → verified webhooks.
