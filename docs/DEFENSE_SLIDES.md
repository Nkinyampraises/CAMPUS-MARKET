
# UNITRADE — Defense Presentation Outline (12 slides)

A slide-by-slide script for your final-year defense (~12–15 min talk + demo).
For each slide: **what goes on the slide** (keep it short — bullets, not paragraphs) and
**what you say** (your spoken talking points). Don't read the slide; the slide is a prompt.

> **Timing guide:** Slides 1–3 ≈ 3 min · Slides 4–8 ≈ 6 min · Slide 9 (demo) ≈ 4 min · Slides 10–12 ≈ 2 min.
> Aim to finish under your time limit — leave room for questions.

---

## Slide 1 — Title

**On the slide:**

- Project title: **UNITRADE — A Secure Campus Marketplace for Cameroonian Students**
- Your name, matricule, department
- Supervisor's name
- University & date

**What you say:**
Greet the panel. "Good morning. My project is UNITRADE, a secure online marketplace where university students can buy, sell, and rent items, with escrow-protected mobile-money payments."

---

## Slide 2 — Problem Statement

**On the slide:**

- Students trade on WhatsApp groups & notice boards
- 3 pain points: ❌ no trust (scams) · ❌ no structured search · ❌ risky payment & delivery

**What you say:**
Explain the real problem: students constantly buy/sell second-hand items, but there's no safe, organized way to do it. Scams are common because money changes hands with no protection. There's no searchable catalog and no payment safety.

---

## Slide 3 — Objectives

**On the slide:**

- Build a trusted buy/sell/**rent** marketplace
- Secure mobile-money payments with **escrow**
- Role-based dashboards: buyer / seller / admin
- AI assistant for support & product discovery
- Installable **PWA + Android** app

**What you say:**
State your aim and the 5 concrete objectives. Emphasize the headline goal: **solving trust** through escrow.

---

## Slide 4 — Proposed Solution (Overview)

**On the slide:**

- One diagram or 4 icons: **Marketplace · Escrow Payments · AI Assistant · PWA/Mobile**
- Tagline: "Buy, sell, and rent safely — within your campus."

**What you say:**
Give the big picture before details. UNITRADE is campus-scoped, escrow-protected, AI-assisted, and works as an installable app. Contrast briefly with Jumia/Facebook Marketplace (campus-scoped + escrow + renting).

---

## Slide 5 — System Architecture

**On the slide (boxes & arrows):**

```
[ React PWA / Android ]  →  [ Deno + Hono API ]  →  [ PostgreSQL (KV/JSONB) ]
                                     │
              ┌──────────────────────┼─────────────────────┐
          [ Fapshi ]            [ Supabase Storage ]    [ AI: Gemini ]
        (MoMo payments)            (images)            (assistant)
```

**What you say:**
Walk left to right: the client (web + Android) talks to the Deno/Hono backend over secure REST APIs; the backend stores data in PostgreSQL and integrates with Fapshi for payments, Supabase for images, and an AI provider for the assistant. Mention secrets live only on the backend.

---

## Slide 6 — Technology Stack

**On the slide (small table or logos):**

- **Frontend:** React + TypeScript + Vite + Tailwind
- **Backend:** Deno + Hono
- **Database:** PostgreSQL (JSONB key-value)
- **Payments:** Fapshi (MTN MoMo / Orange Money)
- **AI:** Gemini (RAG)
- **Mobile:** PWA + Capacitor (Android)
- **Hosting:** Vercel (frontend) + Render (backend)

**What you say:**
Don't read every logo — highlight 3 "why" choices: TypeScript (fewer bugs), Deno/Hono (lightweight, secure), and Fapshi (the payment method Cameroonian students actually use).

---

## Slide 7 — Core Feature: Escrow Payment Flow ⭐

**On the slide (the money flow — your strongest slide):**

```
Buyer pays (Fapshi)  →  AWAITING_PAYMENT  →  [webhook re-verified]
   →  PAID (money held in escrow = seller's PENDING balance)
   →  Buyer confirms delivery  →  RELEASE (PENDING → AVAILABLE)
   →  Seller withdraws to MoMo
```

**What you say:**
This is the heart of the project — spend the most time here. Explain escrow in plain words (platform holds the money until the buyer confirms), then the two balances (pending vs available), and why the order starts as AWAITING_PAYMENT (payments confirm asynchronously). Drop the key line: **"I never trust the webhook — I re-verify with Fapshi, and the operation is idempotent so it can't double-pay."**

---

## Slide 8 — Core Feature: AI Assistant (Sasha)

**On the slide:**

- Sasha = general Q&A + **product recommendations from live inventory**
- Approach: **RAG (Retrieval-Augmented Generation)** — not fine-tuning
- "Retrieve current listings → feed to the model → grounded recommendations"

**What you say:**
Explain what Sasha does, then justify the approach: I retrieve live listings and give them to the model so recommendations are always current. I deliberately chose RAG over fine-tuning because inventory changes daily and a fine-tuned model would be frozen. This shows design judgment.

---

## Slide 9 — LIVE DEMO 🎬

**On the slide:**

- Just the word **DEMO** + a fallback note ("video/screenshots ready")

**Demo script (do in this order):**

1. Log in (show 2FA exists).
2. Seller creates a listing (with image).
3. Buyer searches, opens item, places order → show **escrow** state change.
4. Show seller wallet: **pending → available**, then a withdrawal.
5. Ask **Sasha**: a general question + "show me [category] available."
6. Show **admin** dashboard: approvals + analytics.
7. (If possible) Install the **PWA** on a phone.

**What you say:**
Narrate each step calmly. **Have screenshots or a screen recording ready** in case the internet or a live payment fails — never let a failed demo derail you.

---

## Slide 10 — Security & Reliability

**On the slide:**

- 🔐 Email verification + **TOTP 2FA** + risk challenges
- 🔁 **Idempotent** payments & webhooks (no double-charge/double-pay)
- 🧾 Full **audit logging** of payment events
- 🔑 Secrets only on the server; HTTPS; server-side authorization

**What you say:**
Show you took security seriously — this is where marks are won. Define authentication vs authorization in one line each, and mention idempotency and audit logs as evidence of real engineering.

---

## Slide 11 — Challenges, Limitations & Future Work

**On the slide (two columns):**

- **Challenges solved:** async payments · trust · choosing RAG · free-tier AI limits
- **Future work:** automated tests · relational tables + indexes · delivery tracking · real-time chat · French/English

**What you say:**
Be honest and confident. Briefly tell one good "war story" (e.g., async payments → AWAITING_PAYMENT + webhook re-verification). Then list limitations and how you'd improve — this maturity scores higher than claiming it's perfect.

---

## Slide 12 — Conclusion & Thank You

**On the slide:**

- "UNITRADE makes student trading **safe, organized, and accessible**."
- Recap: escrow trust · AI discovery · PWA/mobile · buyer/seller/admin
- **Thank you — Questions?**

**What you say:**
Close with the one-sentence pitch, restate the impact (safe trading for students), thank the panel, and invite questions. Stand ready with the `DEFENSE_QA.md` answers in your head.

---

## Presenter Tips

- **Practice out loud at least 3 times** and time yourself.
- **Know your code:** be able to open and explain any file they point to (escrow, auth, AI endpoint).
- **Slides = prompts, not scripts.** Few words, you do the talking.
- **If asked something you don't know:** "I'd need to verify, but my understanding is…" — never bluff.
- **Bring a backup** of the demo (video + screenshots) on the same laptop, offline.
- Dress well, speak slowly, make eye contact with the whole panel.
