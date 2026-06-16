# Repository Guidelines

## Project Overview

Campus Market is a student marketplace web app for Cameroon, supporting buying, selling, and renting items between university students. Currency is FCFA. The app has three user roles — buyer, seller, and admin — each with their own dashboard section.

## Project Structure & Module Organization

- `src/app/App.tsx` — root router; wraps all routes with `AdminSectionLayout`, `BuyerSectionLayout`, or `SellerSectionLayout` guards
- `src/pages/` — one file per page/route; role-prefixed (`Buyer*`, `Seller*`, `Admin*`)
- `src/components/` — shared layout and utility components (Header, Footer, ThemeProvider, `T.tsx` translation wrapper)
- `src/app/components/ui/` — shadcn/ui primitives built on Radix UI; do not edit these directly
- `src/contexts/` — `AuthContext`, `LanguageContext` (FR/EN i18n)
- `src/lib/api.ts` + `src/lib/api-config.ts` — all frontend API calls; `src/data/mockData.ts` is legacy and being replaced
- `server/` — Express + Hono backend (TypeScript source); `server/kv_store.ts` is a key-value abstraction over Postgres
- `api/make-server-50b25a4f/[...path].ts` — Vercel serverless function that proxies to the backend
- `scripts/ai/` — data preparation and fine-tuning scripts for the Kori AI assistant

The `@` path alias resolves to `src/`.

## Build & Development Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite frontend dev server (proxies /make-server-50b25a4f → localhost:8002)
npm run build        # production frontend build
npm run start:dev    # start Express backend (ts-node, port 8002)
npm run start:render # production backend (Render deployment)
```

Copy `.env.example` to `.env` and configure `DATABASE_URL` (Postgres) and Supabase keys before starting the backend.

### AI fine-tuning scripts

```bash
npm run ai:prepare-finetune        # prepare OpenAI fine-tune JSONL from marketplace data
npm run ai:prepare-hf-sft:marketplace  # prepare HuggingFace SFT JSONL
npm run ai:openai:finetune:amazon  # submit fine-tune job to OpenAI
```

## Coding Style & Naming Conventions

- TypeScript throughout; no standalone type checker is configured — rely on Vite's build output for type errors
- Tailwind CSS v4 via `@tailwindcss/vite`; use utility classes, not inline styles
- UI components: prefer shadcn/ui primitives in `src/app/components/ui/`; MUI and Ant Design are also present but use sparingly
- Page components are named in PascalCase and exported as named exports matching the filename
- All user-visible strings must go through `useLanguage()` / the `<T>` component to support FR/EN switching
- Use the `@` alias for all src imports (e.g., `import { foo } from '@/lib/api'`)
- The `react()` and `tailwindcss()` Vite plugins must both remain in `vite.config.ts`

## Architecture Notes

- The dev proxy (`/make-server-50b25a4f` prefix) is required for both frontend API calls and Vercel deployment routing — do not change this path
- `server/kv_store.ts` abstracts all Postgres reads/writes; business logic should go through it rather than querying `pg` directly
- Supabase is used only for auth and file uploads; all business data lives in Postgres
- AI provider is runtime-switchable via `AI_PROVIDER` env var (`openai`, `gemini`, `huggingface`, `auto`)
- Capacitor (`capacitor.config.json`) wraps the app for Android; use `VITE_ANDROID_API_URL` for mobile API targets

## Commit Guidelines

Use imperative, descriptive commit messages. Reference the area and the fix:

```
Fix escrow flow: correct refund, auto-payout, platform fee logic
Fix: import getUniversityById in ItemDetails — was crashing item detail page
Admin inbox: full conversation viewer for all buyer-seller chats
```
