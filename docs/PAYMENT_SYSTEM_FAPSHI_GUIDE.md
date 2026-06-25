# Fapshi Payments & Escrow Guide (Campus Market / UNITRADE)

This is the **current** payment integration. It replaced the old CamPay + manual USSD
system. All collection and payouts go through **Fapshi**:

- **Collection (charging buyers):** Fapshi **Direct Pay** (`POST /direct-pay`) — pushes a
  mobile-money PIN prompt to the buyer's phone.
- **Payout (paying sellers / refunds):** Fapshi **Payout** (`POST /payout`).
- **Status / verification:** `GET /payment-status/:transId` — the single source of truth.

Everything lives in `server/index.ts`; the checkout UI is `src/pages/PaymentReview.tsx`.

---

## 1. Why the flow changed

CamPay's collect call was effectively synchronous in our old code, and orders were
created as **immediately paid**. Fapshi Direct Pay is **asynchronous**: it returns
`PENDING`, then a webhook reports `SUCCESSFUL`/`FAILED`. Crediting sellers before
confirmation would credit unpaid orders, so we added a new **`AWAITING_PAYMENT`** state.

```
Buyer confirms  ──▶  POST /direct-pay  ──▶  order = AWAITING_PAYMENT (escrow held, no wallet credit)
                                              │  (PIN prompt on buyer's phone)
Fapshi webhook ──▶ re-verify via GET /payment-status/:transId
   SUCCESSFUL ──▶ confirmEscrowOrderPaid()  ──▶ escrow HOLD + seller credited ──▶ PAID_PENDING_DELIVERY
   FAILED/EXP ──▶ voidAwaitingEscrowOrder()  ──▶ listing freed ──▶ PAYMENT_FAILED
```

The buyer's browser polls `GET /orders/:id` until the status flips.

The same gating applies to **subscriptions** (`POST /subscription/update`): the
subscription stays `pending` and is activated by the webhook (`activateSubscriptionFromPayment`).

## 2. Credentials & environment

Fapshi authenticates with two headers — `apiuser` and `apikey` — and uses a **separate
pair per service** (collection vs payout). There is no token exchange.

```
PAYMENT_PROVIDER_MODE="fapshi"          # or "mock" to simulate without charging
FAPSHI_BASE_URL="https://live.fapshi.com"   # sandbox: https://sandbox.fapshi.com
FAPSHI_FORCE_MOCK="false"               # "true" = kill-switch, simulate success
FAPSHI_COLLECTION_API_USER="…"          # charging buyers
FAPSHI_COLLECTION_API_KEY="…"
FAPSHI_PAYOUT_API_USER="…"              # paying sellers / refunds
FAPSHI_PAYOUT_API_KEY="…"
FAPSHI_WEBHOOK_URL="https://<host>/fapshi/webhook"   # a URL, not a secret
```

Notes:
- **Minimum amount is 100 XAF** (`FAPSHI_MIN_AMOUNT`). Items below this are rejected.
- Phone numbers are sent to Fapshi as **9-digit local** numbers (e.g. `671234567`), not
  E.164 — see `formatCameroonPhoneLocal`.
- `medium`: `"mobile money"` (MTN) or `"orange money"`.

## 3. Webhook security (important)

Fapshi webhooks are **not HMAC-signed**. The handler therefore **never trusts the POST
body** — it extracts only `transId` and re-fetches `GET /payment-status/:transId`, then
acts on the API-returned status. Processing is **idempotent per transId**
(`fapshi:webhook:processed:<transId>`), so retries and duplicates are safe.

Routes (all map to the same handler):
- `POST /fapshi/webhook` and `POST /make-server-50b25a4f/fapshi/webhook`
- `POST /campay/webhook` (+ prefixed) — backward-compatible alias for old dashboard URLs.

Configure the callback URL in the Fapshi dashboard and ensure **Direct Payment is enabled**
on the collection service.

## 4. Idempotency & money safety

- **Orders:** escrow hold + wallet credit happen exactly once, gated on
  `escrow.status === AWAITING` inside `confirmEscrowOrderPaid`. Release/refund still require
  `escrow.status === PENDING`, so an unconfirmed order can never be released or refunded.
- **Payouts:** each payout transId is indexed (`fapshi:tx:<transId>`, `type: "payout"`).
  Pending payouts are stored as `WITHDRAWAL_STATUS.PROCESSING`; the webhook flips them to
  `COMPLETED`, or to `FAILED` **and refunds the held amount back to the wallet exactly once**
  (`reconcileFapshiPayout`, guarded by `walletRefunded`).

## 5. Audit log

Every payment event is appended to `payment:audit:<id>` (indexed at `payment:audit:ids`,
capped at 1000): `direct_pay_initiated`, `payout_initiated`, `webhook_received`,
`webhook_verified`, `order_confirmed`, `order_failed`, `payout_completed`, `payout_failed`,
`subscription_pending`, `subscription_activated`, `subscription_failed`, plus error events.

## 6. Testing without real money

Set `FAPSHI_FORCE_MOCK="true"` (or omit collection credentials). Collection/payout return a
synchronous mock success, so checkout confirms instantly and the full escrow/wallet/refund
ledger can be exercised with zero charges. Flip to `false` for live.

## 7. Key functions (server/index.ts)

| Concern | Function |
|---|---|
| Low-level HTTP | `callFapshi`, `getFapshiPaymentStatus`, `normalizeFapshiStatus` |
| Collect / payout | `processInboundMobileMoneyPayment`, `processOutboundMobileMoneyPayout` |
| Confirm / void order | `confirmEscrowOrderPaid`, `voidAwaitingEscrowOrder` |
| Payout reconcile | `indexFapshiPayout`, `reconcileFapshiPayout` |
| Subscription | `activateSubscriptionFromPayment`, `failSubscriptionPayment` |
| Webhook | `handleFapshiWebhookPost` |
| Audit | `recordPaymentAudit` |
