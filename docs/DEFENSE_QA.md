# UNITRADE / Campus Market — Final-Year Defense Q&A

A complete preparation guide for your project defense. Questions are grouped by theme.
Each answer is written so you can say it in your own words — understand the *idea*, don't memorize word-for-word.

> **One-sentence pitch (memorize this):**
> "UNITRADE is a student marketplace for Cameroonian universities where students can **buy, sell, and rent** items safely, using **escrow-protected mobile-money payments** through Fapshi, an **AI shopping assistant**, and a **Progressive Web App + Android** experience — built on a React frontend and a Deno/Hono backend with a Postgres database."

---

## 1. Project Overview & Motivation

**Q: What is your project about?**
UNITRADE (Campus Market) is an online marketplace built specifically for university students in Cameroon. Students can list items for sale or for rent, browse and search what others are selling, chat with each other, pay securely with mobile money (MTN MoMo / Orange Money), and receive their money through an escrow system that protects both buyer and seller. It also has an AI assistant that answers questions and recommends products.

**Q: What problem does it solve?**
Students frequently buy and sell second-hand items (textbooks, electronics, furniture, kitchenware), but today this happens on WhatsApp groups and notice boards where: (1) there's no buyer/seller trust — scams are common; (2) there's no structured search; (3) payment and delivery are risky. UNITRADE solves trust with **escrow** (money is held until the buyer confirms delivery), gives a **structured, searchable catalog**, and keeps everything **campus-scoped** (organized by university).

**Q: Who are the users?**
Three roles: **Buyers** (browse, order, rent, chat, review), **Sellers** (list items, manage orders, withdraw earnings, subscribe to premium), and **Admins** (approve listings, manage users/categories/universities, handle disputes, view analytics, manage payouts).

**Q: Why is it specific to Cameroon / students?**
Currency is **FCFA (XAF)**, payments use **Cameroonian mobile money** (the dominant payment method — most students don't have bank cards), listings are organized by **Cameroonian universities** (Buea, Douala, Yaoundé, Bamenda, Dschang), and the AI assistant is tuned to a student context.

**Q: Is it original / what makes it different from Jumia or Facebook Marketplace?**
It's **campus-scoped** (you trade within your university community, reducing risk and delivery distance), it has **built-in escrow** so neither party can be cheated, it supports **renting** not just buying (important for students who need something temporarily), and it has an **AI assistant** that recommends from live inventory.

---

## 2. Objectives & Scope

**Q: What were your objectives?**

1. Build a trusted marketplace where students can buy, sell, and rent.
2. Integrate secure mobile-money payments with **escrow protection**.
3. Provide role-based dashboards (buyer/seller/admin).
4. Add an **AI assistant** for support and product discovery.
5. Deliver it as an installable **PWA and Android app** so it works on low-end phones and offline.

**Q: What is in scope vs out of scope?**
*In scope:* accounts + 2FA, listings (sale + rent), search/filter, orders, escrow, wallet & withdrawals, reviews, chat, notifications, disputes, admin tools, AI assistant, subscriptions.
*Out of scope (future work):* in-app delivery logistics/courier tracking, multi-currency, and a fully autonomous fraud-detection ML model.

---

## 3. Technology Stack (and WHY each choice)

**Q: What technologies did you use and why?**

| Layer      | Technology                                            | Why                                                                                     |
| ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Frontend   | **React 18 + TypeScript + Vite**                | Component reuse, type safety catches bugs early, Vite gives fast builds                 |
| Styling/UI | **Tailwind CSS v4, Radix UI, MUI**              | Rapid, consistent, accessible UI                                                        |
| Routing    | **react-router-dom v7**                         | Standard client-side routing (SPA)                                                      |
| Charts     | **Recharts**                                    | Admin analytics dashboards                                                              |
| Backend    | **Deno + Hono**                                 | Lightweight, fast, modern, secure-by-default runtime; Hono is a tiny fast web framework |
| Database   | **PostgreSQL** (used as a key-value store)      | Reliable, free tiers (Neon/Supabase), JSONB for flexible data                           |
| Storage    | **Supabase Storage**                            | Hosting listing/profile images                                                          |
| Email      | **Nodemailer**                                  | Verification & password-reset emails                                                    |
| Payments   | **Fapshi (live)**                               | Cameroonian mobile-money collection + payout API                                        |
| AI         | **Gemini / OpenAI / HuggingFace**               | Natural-language assistant + recommendations                                            |
| Mobile     | **PWA (vite-plugin-pwa) + Capacitor (Android)** | Installable, offline-capable, native Android wrapper                                    |
| Deploy     | **Vercel (frontend) + Render (backend)**        | Free/cheap managed hosting                                                              |

**Q: Why TypeScript instead of plain JavaScript?**
TypeScript adds static types, so many errors (wrong data shapes, typos, missing fields) are caught at build time instead of crashing in front of a user. It also makes the large codebase easier to maintain and self-documenting.

**Q: Why Deno + Hono instead of Node + Express?**
Deno is a modern, secure-by-default runtime (no implicit file/network access, built-in TypeScript). Hono is extremely lightweight and fast, with a clean routing API. (Note: the repo also contains Express versions used during earlier development, but the **live backend is the Deno/Hono `server/index.ts`**.)

**Q: Why a Single-Page Application (SPA)?**
The UI feels app-like (no full page reloads), state is managed on the client, and it pairs naturally with a PWA for installability and offline support.

---

## 4. Architecture

**Q: Describe your system architecture.**
It's a classic **client–server** architecture:

- **Client:** React SPA (also packaged as a PWA and an Android app via Capacitor). It talks to the backend over HTTPS REST calls (endpoints under `/make-server-50b25a4f/...`).
- **Server:** Deno/Hono API (`server/index.ts`) handling auth, listings, orders, escrow, wallet, AI, admin, notifications.
- **Database:** PostgreSQL accessed through a small **key-value abstraction** (`kv_store.ts`).
- **External services:** Fapshi (payments), Supabase (image storage), an email provider (SMTP), and an AI provider (Gemini/OpenAI/HF).

**Q: How does the frontend talk to the backend?**
Through REST API calls (fetch) with a **JWT/bearer token** in the `Authorization` header for authenticated routes. The server verifies the token on each protected request.

**Q: Why is the frontend on Vercel and the backend on Render?**
They have different jobs. **Vercel** is optimized for serving static frontend assets globally (CDN). **Render** runs the always-on backend process that holds secrets (payment keys, AI keys) and talks to the database. Keeping them separate means secrets live only on the backend, never shipped to the browser.

---

## 5. Database Design

**Q: What database did you use and how is it structured?**
PostgreSQL. I use it as a **key-value store**: a single table (`kv_store_50b25a4f`) with two columns — `key TEXT PRIMARY KEY` and `value JSONB`. Every entity (user, listing, order, escrow, wallet, withdrawal, notification) is stored as a JSON document under a **prefixed key**, e.g. `order:ORD-123`, `listing:item-456`, `wallet:user-789`, `escrow:ESC-123`.

**Q: Why a key-value/JSONB design instead of a normal relational schema with many tables?**

- **Flexibility & speed of development:** the data shape evolved a lot during the project; JSONB let me add fields without migrations.
- **Simplicity:** one access pattern (`get`, `set`, `getByPrefix`) for everything.
- **Good enough for the scale:** a campus marketplace is read-light and the documents are naturally self-contained.

**Q: What are the trade-offs / weaknesses of that choice? (be honest — juries love this)**

- No SQL **joins** or foreign-key **constraints**, so relationships are maintained in application code.
- `getByPrefix` does a `LIKE 'prefix%'` scan, which is fine at small scale but wouldn't be efficient for millions of rows.
- No built-in schema validation.
  **How I'd improve it:** for production scale I'd move hot entities (users, listings, orders) into proper relational tables with indexes and keep JSONB only for flexible/auxiliary data — or add indexes on extracted JSONB fields.

**Q: How do you keep data consistent without transactions across documents?**
Critical multi-step operations (like escrow release) are written carefully and made **idempotent** (safe to retry) using guard keys, and money operations are **audited**. The `mset` helper uses a real DB transaction (BEGIN/COMMIT) where atomic multi-key writes are needed.

---

## 6. Authentication & Security (expect heavy questions here)

**Q: How does authentication work?**
Users register with email + password. The email must be **verified** (a code/link is sent). On login, the server checks credentials and issues a **token**; the client sends that token on every protected request, and the server verifies it. Passwords are never stored in plain text.

**Q: Do you support two-factor authentication?**
Yes — **TOTP-based 2FA** (authenticator apps like Google Authenticator), plus email-code challenges. There are also **risk-based step-up challenges**: if a login looks unusual, the system asks for extra verification.

**Q: How do you protect payments and money operations?**
Four layers:

1. **Escrow** — money is held, not sent directly seller-to-buyer.
2. **Idempotency** — webhooks and payouts use guard keys so the same event can't be processed twice (no double-crediting or double-paying).
3. **Never trust the webhook body** — when Fapshi notifies us of a payment, we **re-verify** by calling Fapshi's payment-status API; we only act on the verified status.
4. **Audit logs** — every payment event is recorded (`payment:audit:*`) for traceability.

**Q: How do you keep secrets safe?**
API keys (Fapshi, AI, DB) are stored as **environment variables on the server (Render)**, never committed to GitHub (`.env` is git-ignored) and never sent to the browser. The frontend only receives public, non-secret values.

**Q: What other security measures exist?**
HTTPS everywhere, CORS configuration, server-side authorization checks (e.g., "only the buyer can confirm delivery," "only an admin can approve listings"), input validation (amounts, phone numbers), and rate limiting on the AI assistant.

**Q: What are the security weaknesses you're aware of?**
The KV model means authorization is enforced in code (must be careful), and the system depends on the email/SMS provider for verification. Future work: penetration testing, stricter rate limiting on auth endpoints, and a Web Application Firewall.

---

## 7. Payment & Escrow System (the most likely deep-dive)

**Q: Walk me through the full payment flow.**

1. Buyer places an order and is taken to **Fapshi's secure checkout** to pay with mobile money.
2. The order is created in an **`AWAITING_PAYMENT`** state — the item is reserved, but **no money is credited yet**.
3. Fapshi processes the payment and sends a **webhook** when it succeeds.
4. We **re-verify** the payment with Fapshi, then move the order to **`PAID_PENDING_DELIVERY`** and credit the seller's **pending** wallet balance (held in escrow).
5. Seller delivers; buyer confirms receipt + satisfaction.
6. On confirmation we **release** escrow: money moves from the seller's **pending** balance to their **available** balance.
7. Seller **withdraws** the available balance to their mobile money via Fapshi **payout**.

**Q: What is escrow and why did you use it?**
Escrow means a trusted third party (the platform) **holds the buyer's money** until the buyer confirms they received what they paid for. It protects the buyer (seller can't take the money and disappear) and the seller (the money is confirmed before they ship). It's the core trust mechanism of the platform.

**Q: Why two wallet balances — "pending" and "available"?**

- **Pending** = money earned but still locked in escrow (order not yet confirmed). Not withdrawable.
- **Available** = released money the seller can actually withdraw.
  This mirrors how the money is legally/financially held and prevents sellers from withdrawing funds for orders that might still be refunded.

**Q: Why is the order created as `AWAITING_PAYMENT` first? Why not credit immediately?**
Because Fapshi confirms payments **asynchronously** (the buyer approves on their phone; success comes seconds later via webhook). If I credited the seller immediately on "order placed," I'd be crediting **unpaid** orders. So I hold the order in `AWAITING_PAYMENT` and only credit when Fapshi **confirms** the money actually arrived.

**Q: What is a webhook and how do you handle it securely?**
A webhook is an HTTP request Fapshi sends to my server to notify me of a payment result. Fapshi's webhooks aren't cryptographically signed, so I **never trust the contents** — I extract only the transaction ID and **call Fapshi back** (`payment-status`) to get the real status. I also make it **idempotent**, so if the webhook is delivered twice, the order is confirmed only once.

**Q: Why Fapshi and not a card processor like Stripe?**
Stripe/cards aren't practical for most Cameroonian students. Fapshi is a **local aggregator for MTN MoMo and Orange Money**, which is how students actually pay. It also offers both **collection** (taking money in) and **payout/disbursement** (sending money out), which I need for seller withdrawals.

**Q: How does the platform make money?**
Through a small **transaction fee** added to the buyer's payment, and optional **seller subscriptions** (premium plans). Platform revenue accumulates in an admin wallet that can be withdrawn.

**Q: What happens if the buyer is not satisfied?**
The order is **refunded**: the held escrow is reversed and the buyer's balance is credited back, the listing is freed, and the order is marked refunded. There's also a **dispute** system for contested cases, handled by admins.

**Q: How do you prevent double-spending or double-**

**payouts?**
Every payout and webhook sets a **guard key** before acting (e.g., `fapshi:payout:<id>`, `fapshi:webhook:processed:<txn>`). If the operation is retried, the guard key makes it a no-op. This is the **idempotency** principle.

**Q: In Fapshi, money is in a Collection wallet but payouts come from a Disbursement wallet — how does that work?**
Fapshi keeps collection and payout balances separate. Collected funds must be moved (Collection → Main → Disbursement) before payouts can draw from them. In production I keep a **funded float** in the payout wallet so seller withdrawals are instant, and periodically sweep collected funds to top it up. *(This is an operational design point, not a code bug.)*

---

## 8. AI Assistant ("Sasha")

**Q: What does your AI assistant do?**
"Sasha" answers general questions (study help, advice, general knowledge) **and** recommends real products from the marketplace based on what the user asks (e.g., "show me pots available").

**Q: How is it built — did you train your own model?**
No — I use a **large language model via API** (Gemini, with OpenAI/HuggingFace as alternatives). I send the model a **system prompt** describing Sasha's behavior, plus the **current listings** from my database, and it replies with an answer and a list of recommended item IDs. The frontend then shows those real products.

**Q: This is RAG — can you explain it?**
Yes. **RAG = Retrieval-Augmented Generation.** Instead of relying only on what the model "knows," I **retrieve** my live listings from the database and inject them into the prompt, so the model **generates** answers grounded in **current, real inventory**. This keeps recommendations accurate and up to date.

**Q: Why didn't you fine-tune a model on a dataset (e.g., from Kaggle)?**
Two reasons:

1. **Inventory is live and changes daily.** A fine-tuned model is frozen at training time — it could never know what's in stock *today*. Only retrieval (RAG) can do that.
2. **General questions** are already answered better by the base model than by fine-tuning on a narrow dataset, which would actually *degrade* general performance.
   So RAG is the correct architecture for this problem. *(The repo contains fine-tuning scripts I explored during research, but the production assistant uses RAG.)*

**Q: How do you stop the AI from inventing fake products or prices?**
The system prompt explicitly instructs it to **only recommend items from the provided listings** with their exact IDs, never to invent products/prices, and to give general advice if nothing matches. The backend then validates the returned IDs against real listings.

**Q: What if the AI provider is down or rate-limited?**
The system **tries multiple providers** in order and, if all fail, returns a safe **fallback message** instead of crashing. There are also daily usage limits to control cost.

---

## 9. Feature Deep-Dives

**Q: How does renting work, and how is it different from buying?**
Buying transfers ownership permanently. **Renting** lets a student use an item for a period and return it — useful for things needed temporarily (e.g., equipment). The platform tracks rentals separately (buyer/seller rentals pages) with their own lifecycle.

**Q: What are seller subscriptions?**
Optional **premium plans** sellers can pay for (via the same Fapshi flow) to get added benefits/visibility. Subscriptions are activated only after payment is confirmed, using the same gated/idempotent logic as orders.

**Q: How do reviews and ratings work?**
After a completed order, buyers can leave a **review and rating** on the seller/item, which builds reputation and trust. Admins can moderate reviews.

**Q: How does messaging/chat work?**
Buyers and sellers can chat in-app to ask questions before/after a purchase, keeping negotiation on-platform (safer and recorded).

**Q: How do notifications work?**
Users get in-app notifications for key events (new order, payment confirmed, escrow released, delivery, disputes). Stored per user and shown in a notifications page.

**Q: What can admins do?**
Approve/reject listings, manage users, categories, and universities, view analytics, manage payouts and platform revenue, moderate reviews, and resolve disputes.

**Q: What is the "background removal" feature?**
When sellers upload product photos, an in-browser tool (`@imgly/background-removal`) can remove the background for cleaner, more professional-looking listings.

---

## 10. PWA & Mobile

**Q: What is a PWA and why did you build one?**
A **Progressive Web App** is a website that can be **installed** like a native app, works **offline** (via a service worker that caches assets), and sends/updates without an app store. For students on varied devices and unreliable internet, this means a fast, installable, resilient experience without forcing a Play Store download.

**Q: You also have an Android app — how?**
**Capacitor** wraps the same web app into a native Android shell, so I get a real installable APK from the same codebase (one codebase, multiple platforms).

**Q: How does offline mode work without breaking payments?**
The service worker caches the app shell and static assets for offline loading, but **API calls (including payments) are network-only** — they never use stale cached data — so financial operations are always live and correct.

---

## 11. Software Engineering Process

**Q: How did you manage your code?**
Version control with **Git/GitHub**, committing incrementally. Secrets kept out of the repo via `.gitignore`.

**Q: How did you test the system?**
Primarily **manual end-to-end testing** (registration, listing, ordering, payment, escrow release, withdrawal), plus **type-checking** the backend and **build verification** of the frontend before each deploy. For payments I used a **mock mode** to simulate the full flow without spending real money, then did a small **live smoke test**.

**Q: What was your development methodology?**
Iterative/incremental: build a feature, test it, refine, deploy. I prioritized the core trust loop (list → order → escrow → release → withdraw) first, then added AI, subscriptions, and admin tooling.

**Q: How do you handle errors and failures gracefully?**
Try/catch around external calls (payments, AI, DB), retries with back-off for transient DB connection issues, safe fallbacks (AI fallback message, payout marked "processing" until confirmed), and clean error messages to the user without leaking secrets.

---

## 12. Challenges & How You Solved Them (great to volunteer)

1. **Asynchronous payments** — payments confirm seconds later via webhook. *Solution:* the `AWAITING_PAYMENT` state + webhook re-verification + idempotency, so sellers are only credited for genuinely paid orders.
2. **Trust between strangers** — *Solution:* escrow with pending/available balances and a dispute/refund system.
3. **Choosing the right AI approach** — fine-tuning couldn't handle live inventory. *Solution:* RAG over current listings.
4. **Free-tier constraints** — the default Gemini model had zero free quota for my region. *Solution:* switched to a model (`gemini-2.5-flash`) that's available on the free tier; HuggingFace as backup.
5. **Separate Fapshi collection/disbursement balances** — *Solution:* keep a funded float in the payout wallet and sweep collected funds.
6. **Flexible, fast-changing data** — *Solution:* JSONB key-value store to iterate without migrations.

---

## 13. Limitations & Future Work (always asked)

**Q: What are the limitations of your project?**

- KV/JSONB storage isn't ideal at very large scale (no joins/indexes on relationships).
- No automated test suite yet (mostly manual testing).
- Delivery/logistics is manual (no courier integration).
- Depends on third-party uptime (Fapshi, AI provider, email).
- Payout wallet needs manual top-up because Fapshi has no auto-settlement.

**Q: What would you add with more time?**

- Proper relational tables + indexes for hot data, and automated tests (unit + integration).
- Delivery/courier tracking and in-app maps.
- Real-time chat with WebSockets and push notifications.
- A fraud/risk ML model for suspicious orders.
- Multi-language (French/English) and possibly multi-country support.

---

## 14. Curveball / Conceptual Questions (be ready)

**Q: Is your system scalable? How would you scale it?**
For the current campus scale, yes. To scale further: move hot data to indexed relational tables, add caching (e.g., Redis), run multiple backend instances behind a load balancer, and use a CDN (already do for the frontend). The stateless API design makes horizontal scaling straightforward.

**Q: What happens if two buyers try to buy the same item at once?**
The listing is **reserved** the moment an order enters `AWAITING_PAYMENT`, which blocks a second purchase of the same item, preventing double-selling.

**Q: How do you ensure the buyer actually gets the item before releasing money?**
Money is only released when the **buyer explicitly confirms** receipt and satisfaction. If they're not satisfied, it's refunded or disputed. The platform never auto-releases without buyer confirmation.

**Q: What is the difference between authentication and authorization in your app?**
**Authentication** = proving *who you are* (login, 2FA). **Authorization** = what you're *allowed to do* (only sellers can list, only the buyer of an order can confirm it, only admins can approve listings). I enforce both — authentication via tokens, authorization via server-side role/owner checks.

**Q: Why JSONB and not MongoDB if you wanted a document store?**
PostgreSQL with JSONB gives me document flexibility **and** the option to use full SQL/relational features later, on one reliable, free-tier-friendly database — best of both worlds without running a second database system.

**Q: How is your data backed up / what about data loss?**
The managed Postgres provider (Neon/Supabase) handles backups/replication. I also made a JSON export during data cleanup. Production backups would be scheduled.

**Q: What is idempotency and why does it matter here?**
Idempotency means doing an operation **multiple times has the same effect as doing it once**. It matters because webhooks and network retries can deliver the same payment event twice — without idempotency I could pay or credit someone twice. Guard keys ensure each event is processed exactly once.

**Q: If you had to redo the project, what would you change?**
Start with a clearer relational schema for core entities, add automated tests from day one, and design the payment provider integration behind an interface from the start so switching providers (CamPay → Fapshi) is trivial.

**Q: Did you build this alone? What was your specific contribution?**
*(Answer honestly about your role — architecture, frontend, backend, payment integration, AI, etc. Be ready to explain any part of the code you're asked about.)*

---

## 15. Live Demo Checklist (prepare before the defense)

- [ ] Register a new account → verify email → enable 2FA.
- [ ] Seller: create a listing (with image), see it after admin approval.
- [ ] Buyer: search/filter, open an item, place an order.
- [ ] Show the **escrow** state moving: AWAITING_PAYMENT → PAID → confirm → released.
- [ ] Show the seller wallet (pending → available) and a withdrawal.
- [ ] Ask **Sasha** a general question AND "show me [category] available" → show real recommendations.
- [ ] Show the **admin** dashboard: approvals, analytics, payouts.
- [ ] Install the **PWA** on a phone (Add to Home Screen) to prove it's installable.
- [ ] Have a **backup plan**: screenshots/video in case the internet or a live payment fails during the demo.

---

## 16. 60-Second Summary (your opening statement)

"UNITRADE is a campus marketplace for Cameroonian students to buy, sell, and rent items safely. The core problem it solves is **trust** — so every transaction is protected by an **escrow system**: the buyer pays through **Fapshi mobile money**, the platform holds the funds, and the seller is only paid once the buyer confirms delivery. It has **role-based dashboards** for buyers, sellers, and admins, an **AI assistant** that recommends real products using retrieval-augmented generation, and it's delivered as an **installable PWA and Android app**. Technically, it's a **React + TypeScript** frontend and a **Deno/Hono** backend on a **PostgreSQL** database, deployed on **Vercel and Render**, with security features like **2FA, idempotent payment handling, and full audit logging**."
