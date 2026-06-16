# Campus Market (UniTrade) — Architecture

A full-stack **student marketplace for Cameroon** where university students buy, sell, and
rent items (furniture, electronics, etc.). Prices are in **FCFA/XAF**, payments use mobile
money (MTN MoMo / Orange Money), the UI is bilingual (English/French), and there are three
roles: **buyer, seller, admin**. It ships as a web SPA and an Android app (Capacitor).

---

## 1. High-level shape

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (React 18 + Vite 6 + TS, Tailwind v4 + shadcn/ui)    │
│  - 60+ routes, role-based layouts (Buyer/Seller/Admin)       │
│  - Context-only state (Auth, Language, Theme)                │
│  - Capacitor wrapper for Android                             │
└───────────────┬─────────────────────────────────────────────┘
                │  fetch → /make-server-50b25a4f/*  (adaptive base URL)
┌───────────────▼─────────────────────────────────────────────┐
│  BACKEND (Hono router on Express/Node, server/index.ts)      │
│  - JWT auth (PBKDF2), 2FA, escrow orders, payments,          │
│    messaging (WebSocket), AI assistant, admin tools          │
└───────────────┬─────────────────────────────────────────────┘
                │  pg pool
┌───────────────▼─────────────────────────────────────────────┐
│  POSTGRES  — relational tables + JSONB KV store              │
│  Supabase used only for auth + file storage; AI: OpenAI/     │
│  Gemini/HuggingFace; Mail: Nodemailer/SMTP                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend

- **Bootstrap:** `src/main.tsx` → `src/app/App.tsx`. Provider stack:
  `AuthProvider → ThemeProvider → LanguageProvider → Router → AppLayout`.
- **Routing:** React Router v7, 60+ routes defined in `App.tsx`. Grouped into:
  - Public: `/`, `/marketplace`, `/item/:id`, auth pages (`/login`, `/register`,
    `/forgot-password`, `/reset-password`, `/confirm-email`), `/ai-assistant`.
  - Role sections wrapped in `AdminSectionLayout`, `BuyerSectionLayout`,
    `SellerSectionLayout` (each with its own sidebar).
- **State management:** **No Redux / Zustand / React Query.** Entirely React Context +
  per-page `useState`; all data fetching is manual `fetch`.
  - `src/contexts/AuthContext.tsx` — tokens, auto-refresh with race-guard, 2FA, dual
    local/session storage ("remember device").
  - `src/contexts/LanguageContext.tsx` — EN/FR with 300+ hardcoded translation keys
    (no i18n library).
  - Theme via `next-themes` (light / "Forest Night" dark).
- **UI:** Tailwind CSS v4 (`@theme inline` + CSS variables in `src/styles/theme.css`) +
  ~48 shadcn/ui components in `src/app/components/ui/`. Lucide icons; MUI/AntD used
  sparingly. Toasts via `sonner`, charts via `recharts`, forms via `react-hook-form`.
- **API client:** `src/lib/api.ts` + `src/lib/api-config.ts` resolve the backend base URL
  adaptively (localhost dev → remote web → Capacitor/Android), then append the
  `/make-server-50b25a4f` prefix.
- **Notable:** `src/pages/Messages.tsx` is very large (~170 KB) — a WhatsApp-style chat.
  No client-side route guards; pages check `useAuth()` manually.

---

## 3. Backend

- **Framework:** **Hono** router running on Express/Node — `server/index.ts` is ~8,900
  lines (effectively a monolith). Helpers: `server/auth.ts`, `server/kv_store.ts`,
  `server/mail.ts`.
- **Middleware:** permissive CORS (`*`), 50 MB JSON/urlencoded body limit, request logging.
- **Auth:** JWT (HS256), access token ~12 h / refresh ~30 d stored in the KV store,
  **PBKDF2-SHA256 @ 120k iterations**, optional email-code 2FA and email confirmation.
  Roles: `role` = `student` | `admin`, `userType` = `buyer` | `seller`.
- **API surface (~120 endpoints):** auth, listings, orders, payments, wallet/withdrawals,
  messages + WebSocket, favorites, reviews, notifications, reports, AI chat, uploads, and a
  large admin block (approvals, analytics, payouts, broadcasts, moderation, universities,
  categories).
- **Escrow order flow:** `seller-proof → seller-decision → buyer-confirm → refund`.
- **Real-time:** WebSocket at `/messages/ws` for chat + typing indicators, in-memory
  `wsClients` map, HTTP-polling fallback (e.g. on Vercel).
- **Uploads:** `POST /upload` — 5 MB max, JPEG/PNG/WebP, stored as base64 in the KV store
  (`file:{id}`), served via `GET /files/:id`.

---

## 4. Data model

**Postgres** with a hybrid design:

- **Relational tables:** `listings`, `profiles`, `escrow_transactions`, `transactions`,
  `wallets`, `reviews`, plus `auth.users`.
- **JSONB KV store** (`kv_store_50b25a4f`): user profiles, messages/conversations, AI chat
  history, file metadata — keyed like `user:{id}`, `message:{id}`,
  `conversation:{a}:{b}`, `file:{id}`, `wallet:{id}`, `auth:refresh:{token}`.
- **Client TS types** live in `src/data/mockData.ts` (User, Item, Message, Transaction,
  Review, Category, University, Location) — also holds legacy seed data (14 Cameroon
  universities, 6 categories) being phased out in favor of the live API.

---

## 5. Integrations & ops

- **Payments:** NotchPay / Campay (MTN / Orange mobile money), webhook-driven, with escrow
  and a pickup-location cash option.
- **AI assistant ("Sasha" / "Kori"):** runtime-switchable OpenAI / Gemini / HuggingFace
  (`AI_PROVIDER`), daily rate limit, plus fine-tuning scripts in `scripts/ai/`.
- **Email:** Nodemailer over SMTP (confirmations, password resets, 2FA codes).
- **Deploy:**
  - Frontend on **Vercel** (`api/make-server-50b25a4f/[...path].ts` serverless proxy).
  - Backend on **Render** (`npm run start:render`).
  - Android via **Capacitor 8**.
- **Dev workflow:**
  - `npm run dev` — Vite frontend; proxies `/make-server-50b25a4f` → `localhost:8002`.
  - `npm run start:dev` — ts-node backend on port 8002.
  - **No test framework** (no vitest / jest / playwright).

---

## 6. Design system

`design-system/design-system.md` is the canonical spec: forest-green / teal / cream
palette, semantic tokens (light + "Forest Night" dark mode), Inter typography, 4 px spacing
scale, pill-shaped controls, responsive 12 / 8 / 4-column grids. Supporting docs:
`FIGMA_REDESIGN_PROMPT.md`, `STITCH_DESIGN_PROMPTS.md`, PNG mockups in `reference design/`,
and a custom `.claude/agents/ui-design-expert.md` agent for design-system audits.

---

## 7. Observations & risks

- **Backend monolith:** `server/index.ts` at ~8,900 lines is a maintainability hotspot;
  splitting by resource would help.
- **No automated tests** anywhere — all QA is manual/visual.
- **No client route guards** — protection relies on per-page `useAuth()` checks; worth
  auditing for leaked authenticated views.
- **Secrets in `.env`:** the repo `.env` contains live-looking SMTP / payment credentials.
  Rotate them and ensure `.env` is never committed.
- **Hybrid data model:** mixing relational tables with a JSONB KV store adds flexibility but
  makes querying/reporting harder and risks data-shape drift.
- **No data-fetching layer:** manual `fetch` everywhere means no caching/dedupe; React Query
  or SWR would remove a lot of boilerplate.
- **Mixed UI libs** (shadcn + MUI + AntD) risk visual inconsistency against the design
  system.

---

## 8. Key files

| Area | File |
|------|------|
| App entry / routing | `src/app/App.tsx`, `src/main.tsx` |
| Auth state | `src/contexts/AuthContext.tsx` |
| i18n | `src/contexts/LanguageContext.tsx` |
| API client | `src/lib/api.ts`, `src/lib/api-config.ts` |
| Client types / seed | `src/data/mockData.ts` |
| Backend (all routes) | `server/index.ts` |
| Auth / JWT / 2FA | `server/auth.ts` |
| Postgres KV store | `server/kv_store.ts` |
| Email | `server/mail.ts` |
| Theme tokens | `src/styles/theme.css` |
| Design spec | `design-system/design-system.md` |
| Build config | `vite.config.ts`, `package.json` |
