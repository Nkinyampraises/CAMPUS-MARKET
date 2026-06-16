# Campus Market (UniTrade) — Design System

Source of truth for all UI styling decisions. Synthesized from `FIGMA_REDESIGN_PROMPT.md`,
`STITCH_DESIGN_PROMPTS.md`, and `reference design/*.png`, and mapped onto the project's
existing token architecture (`src/styles/theme.css`, Tailwind v4 `@theme inline`, shadcn/ui).

**Goal:** a clean, premium, "2026 SaaS" look — professional and academic, generous
whitespace, soft elevation, pill-shaped controls — consistent across every page and both
light and dark mode.

> **Scope reminder:** this document governs styling, layout, color, typography, spacing,
> icons, and responsiveness ONLY. See [Non-negotiables](#non-negotiables) at the bottom
> before making any change derived from this spec.

---

## 1. Brand Palette (raw values)

Define these as raw brand colors in `:root` (light) — the semantic tokens in §2 derive
from them, mirroring the existing "Brand palette" comment block in `theme.css`.

| Token | Hex | Notes |
|---|---|---|
| `--forest` | `#1B5E44` | Primary brand color |
| `--forest-dark` | `#134035` | Hover/pressed |
| `--forest-light` | `#2D7A5F` | Secondary surfaces, dark-mode primary |
| `--teal` | `#0D9488` | Accent — links, focus ring, CTAs |
| `--teal-light` | `#5EEAD4` | Active nav text on dark surfaces, hover glow |
| `--cream` | `#F5F0E8` | Page background |
| `--cream-dark` | `#EDE8DC` | Input fills, secondary surfaces |
| `--ink` | `#1A1A1A` | Primary text |
| `--ink-muted` | `#4A5568` | Secondary text |
| `--ink-faint` | `#9CA3AF` | Placeholder / caption text |
| `--success` | `#16A34A` | Success states |
| `--warning` | `#D97706` | Warning states |
| `--danger` | `#DC2626` | Errors, destructive |
| `--critical` | `#7C3AED` | Critical alerts |

---

## 2. Semantic Tokens — Light Mode (`:root`)

> **Applied direction (hybrid, implemented in `theme.css`):** the reference screenshots use a
> clean **white/light** look rather than cream, so the implemented values are:
> `--background: #F6F8F7`, `--card: #FFFFFF`, `--foreground: #0F1A14`, brand **green**
> `--primary: #05B43D` / `--primary-strong: #018F2D` / `--primary-soft: #E7F6EC`,
> `--secondary`/`--muted: #EEF2F0`, `--accent: #E1F4E9`, `--border: #E3E9E6`,
> `--ring: #05B43D`, `--radius: 0.75rem`, font **Inter** @ 16px. Sidebars/footer use **deep
> forest** (`--sidebar: #0E5A38`, active `#0A3F28` with `#80EE98` text). The forest/teal/cream
> table below is the original spec; values above supersede it where they differ.

These map 1:1 to the variable names already consumed by `@theme inline` in `theme.css` —
only the values change, not the names.

| Variable | Value | Usage |
|---|---|---|
| `--background` | `var(--cream)` `#F5F0E8` | Page background |
| `--app-background-image` | `none` | |
| `--foreground` | `var(--ink)` `#1A1A1A` | Default text |
| `--card` | `#FFFFFF` | Cards, panels, modals |
| `--card-foreground` | `var(--ink)` | |
| `--popover` / `--popover-foreground` | `#FFFFFF` / `var(--ink)` | Dropdowns, popovers |
| `--primary` | `var(--forest)` `#1B5E44` | Primary buttons, active nav, links on light bg |
| `--primary-strong` | `var(--forest-dark)` `#134035` | Hover/pressed primary |
| `--primary-soft` | `#E7F0EC` | Tinted backgrounds for primary badges/icons |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--secondary` | `var(--cream-dark)` `#EDE8DC` | Secondary surfaces, input fills |
| `--secondary-foreground` | `var(--ink-muted)` `#4A5568` | |
| `--muted` | `var(--cream-dark)` `#EDE8DC` | Muted surfaces |
| `--muted-foreground` | `var(--ink-faint)` `#9CA3AF` | Captions, placeholders |
| `--accent` | `#CCFBF1` | Teal-tinted badge/icon backgrounds |
| `--accent-foreground` | `var(--teal)` `#0D9488` | |
| `--destructive` | `var(--danger)` `#DC2626` | |
| `--destructive-foreground` | `#FFFFFF` | |
| `--border` | `#E2D9CC` | Dividers, card/input borders |
| `--input` / `--input-background` | `#FFFFFF` | |
| `--switch-background` | `var(--ink-faint)` `#9CA3AF` | |
| `--ring` | `var(--teal)` `#0D9488` | Focus rings |
| `--chart-1..5` | forest, teal, warning, ink-faint, danger | Recharts series |
| `--radius` | `0.625rem` (10px) | Base card/button radius |

### Sidebar tokens (dashboard nav — Admin/Buyer/Seller layouts)

| Variable | Value | Usage |
|---|---|---|
| `--sidebar` | `var(--forest)` `#1B5E44` | Sidebar background |
| `--sidebar-foreground` | `#FFFFFF` | Default sidebar text |
| `--sidebar-primary` / `--sidebar-accent` | `var(--forest-dark)` `#134035` | Active item background |
| `--sidebar-primary-foreground` / `--sidebar-accent-foreground` | `var(--teal-light)` `#5EEAD4` | Active item text |
| `--sidebar-border` | `rgba(255,255,255,0.10)` | |
| `--sidebar-ring` | `var(--teal-light)` `#5EEAD4` | |

### Status badge pairs (use as `bg`/`text` combos, e.g. for risk/status badges)

| Status | Background | Text |
|---|---|---|
| Success / Low | `#DCFCE7` | `#16A34A` |
| Warning / Moderate | `#FEF3C7` | `#D97706` |
| Danger / High | `#FEE2E2` | `#DC2626` |
| Critical | `#EDE9FE` | `#7C3AED` |
| Teal / Info | `#CCFBF1` | `#0D9488` |

---

## 3. Semantic Tokens — Dark Mode (`.dark`, "Forest Night")

Evolves the current "Luxury Emerald" glass treatment (keep glassmorphism, blur, glow,
custom scrollbar) but re-hues it from lime-green toward forest/teal for brand consistency.

| Variable | Value | Usage |
|---|---|---|
| `--background` | `#07140F` | |
| `--app-background-image` | `linear-gradient(135deg, #07140F 0%, #0B2018 50%, #0F2A20 100%)` | |
| `--foreground` | `#F1F5F3` | |
| `--card` | `#0F2A20` | |
| `--card-foreground` | `#F1F5F3` | |
| `--popover` / `--popover-foreground` | `#0B2018` / `#F1F5F3` | |
| `--primary` | `#14B8A6` | Brighter teal pops against dark forest |
| `--primary-strong` | `#0D9488` | |
| `--primary-soft` | `rgba(20,184,166,0.15)` | |
| `--primary-foreground` | `#07140F` | |
| `--secondary` / `--muted` | `#0B2018` / `#0F2A20` | |
| `--secondary-foreground` / `--muted-foreground` | `#A8B5AE` / `#8FA89C` | |
| `--accent` | `#123226` | |
| `--accent-foreground` | `#F1F5F3` | |
| `--destructive` | `#EF4444` | |
| `--destructive-foreground` | `#FFFFFF` | |
| `--border` | `rgba(20,184,166,0.18)` | |
| `--input` / `--input-background` | `#0F2A20` / `#0B2018` | |
| `--switch-background` | `#1A3B2C` | |
| `--ring` | `#14B8A6` | |
| `--chart-1..5` | `#14B8A6, #2D7A5F, #D97706, #8FA89C, #EF4444` | |
| `--sidebar` | `#06120D` | |
| `--sidebar-foreground` | `#CFE8DD` | |
| `--sidebar-primary` / `--sidebar-accent` | `#0F2A20` | |
| `--sidebar-primary-foreground` / `--sidebar-accent-foreground` | `#14B8A6` | |
| `--sidebar-border` | `rgba(20,184,166,0.14)` | |
| `--sidebar-ring` | `#14B8A6` | |

Keep existing `.dark [data-slot='card']` glass/glow rules and scrollbar gradient — just
swap the emerald (`#0DBB3F`/`#1ED760`) hex values for teal (`#14B8A6`/`#0D9488`).

---

## 4. Typography

Replace the Manrope/Sora pairing with a single family — **Inter** — for a calmer,
more "SaaS-standard" feel. Weight (not size+bold-everywhere) carries hierarchy.

- `--font-body` / `--font-heading`: `'Inter', 'Segoe UI', 'Helvetica Neue', sans-serif`
- Base `--font-size`: `16px` (down from 18px)

| Token | Size | Weight | Line-height | Usage |
|---|---|---|---|---|
| Display | 2.25rem (36px) | 700 | 1.15 | Hero headlines (Home) |
| H1 | 1.875rem (30px) | 700 | 1.2 | Page titles |
| H2 | 1.5rem (24px) | 600 | 1.25 | Section headings |
| H3 | 1.25rem (20px) | 600 | 1.3 | Card titles |
| H4 | 1.125rem (18px) | 600 | 1.35 | Subheadings |
| Body | 1rem (16px) | 400 | 1.6 | Default paragraph text |
| Body Small | 0.875rem (14px) | 400 | 1.5 | Secondary text, form labels |
| Caption | 0.75rem (12px) | 500 | 1.4 | Timestamps, badges, helper text |

Remove the global `font-weight: 600/700` forcing on `p`, `.text-xs`, `.text-sm`,
`.text-base` in `index.css` — let weight vary per the scale above. Use `font-medium`/
`font-semibold` utilities explicitly where emphasis is needed.

---

## 5. Spacing, Radius, Shadows, Layout

- **Spacing**: Tailwind's default 4px-based scale (1=4px … 16=64px, 20=80px). No
  arbitrary pixel values in new/refactored markup.
- **Radius scale** (derived from `--radius: 0.625rem`):
  - `sm` (6px) — inputs, small badges
  - `md` / base (10px) — buttons, cards
  - `lg` (16px) — modals, large panels, hero sections
  - `full` — pills (search bar, category chips, status badges, avatars)
- **Shadows**:
  - `card`: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
  - `elevated` (hover): `0 4px 16px rgba(27,94,68,0.10)`
  - `modal`: `0 20px 60px rgba(0,0,0,0.15)`
- **Layout grid**: 1280px max-width container, 24px gutter; 12 columns desktop
  (`lg:` ≥1024px), 8 columns tablet (`md:` ≥768px), 4 columns mobile (`<640px`).
  Use Tailwind's default breakpoints (`sm`/`md`/`lg`/`xl`) — no custom breakpoints.

---

## 6. Icons

- `lucide-react` exclusively (already the only icon library imported by pages).
- Default size **20px** (`size-5`); header/nav icons **24px** (`size-6`); inline/badge
  icons **16px** (`size-4`).
- Outline style (lucide default), stroke-width 2 — do not mix with MUI/Ant icon sets.

---

## 7. Core Components

### Buttons (`src/app/components/ui/button.tsx`)
- `default` (primary): `bg-primary text-primary-foreground hover:bg-primary-strong`
- `accent` (new variant, optional): `bg-[var(--teal)] text-white hover:bg-[var(--forest-dark)]`
  — for secondary CTAs like "Buy Now" / "Register" per reference screenshots
- `outline` (secondary): `border border-primary text-primary bg-transparent hover:bg-primary-soft`
- `destructive`: `bg-destructive text-destructive-foreground`
- `ghost` / `link`: unchanged structure, driven by tokens
- Replace hardcoded `bg-[#05B43D]` / `hover:bg-[#018F2D]` with `bg-primary` /
  `hover:bg-primary-strong` so theme + dark mode apply automatically.
- Radius stays `rounded-xl` for `lg`, `rounded-md`/`rounded-full` family for pills.

### Cards
- `bg-card border border-border rounded-[var(--radius)] shadow-[var(--shadow-card)]`
- Hover (interactive cards, e.g. product cards): elevate to `shadow-elevated`,
  optional `-translate-y-0.5` micro-interaction.

### Inputs / Forms
- `bg-input border border-border rounded-md h-10 focus-visible:ring-2 focus-visible:ring-ring`
- Placeholder text uses `--muted-foreground`.

### Header / Top Nav (`src/components/Header.tsx`)
- `bg-card border-b border-border` (white on light, `--card` on dark), sticky.
- Search bar: pill (`rounded-full`), `bg-secondary` (cream), teal search icon.
- Category chips below search: pill badges, `bg-secondary text-foreground`;
  active chip `bg-primary text-primary-foreground`.
- Icon buttons (favorites/messages/notifications) keep their existing badge-count
  pattern, recolor badges per the status pairs in §2.
- Avatar: circular, teal initials fallback (`bg-accent text-accent-foreground`).
- Replace all `text-[#4A4A4A]`, `border-[#DDE3E2]`, `bg-[#e6f9ee]` etc. with
  `text-muted-foreground`, `border-border`, `bg-primary-soft`.

### Sidebar (Admin/Buyer/Seller section layouts)
- `bg-sidebar text-sidebar-foreground`; active item
  `bg-sidebar-primary text-sidebar-primary-foreground rounded-lg`.

### Footer (`src/components/Footer.tsx`)
- `bg-primary` (forest), white/cream text, links use `--teal-light` (`#5EEAD4`).
- 4-column grid on desktop (`lg:grid-cols-4`), stacked on mobile.
- Replace the `.footer-dark` gradient with a flat `bg-primary` per the "no gradients"
  direction in the reference design — or keep a very subtle forest gradient if it
  reads better in dark mode.

---

## 8. Responsive Guidelines

- Mobile-first. Product/listing grids: `grid-cols-2` → `sm:grid-cols-3` →
  `lg:grid-cols-4`.
- Dashboard sidebars collapse to a `Sheet`/drawer below `lg`.
- Tables become stacked card lists below `md`; where a table must remain, keep the
  existing `.overflow-x-auto > table { min-width: 640px }` escape hatch.
- Minimum touch target 44×44px for icon buttons on mobile.

---

## 9. Migration Notes (current state → target)

- `src/styles/fonts.css`: swap the Google Fonts `@import` from Manrope/Sora to Inter.
- `src/styles/theme.css`: replace `:root` and `.dark` variable values per §2/§3;
  keep variable *names* and the `@theme inline` block as-is.
- `src/styles/index.css`: change `--font-size` to `16px`; remove forced
  `font-weight: 600/700` on `p`/`.text-xs`/`.text-sm`/`.text-base`.
- The large `@layer utilities` block in `theme.css` that remaps arbitrary Tailwind
  classes (`bg-green-600`, `text-slate-900`, `border-gray-200`, etc.) to theme colors
  is a compatibility shim for legacy hardcoded classes. As pages are migrated to
  semantic classes (`bg-primary`, `text-foreground`, `border-border`), this shim
  becomes unnecessary for that file — but leave it in place (re-derived against the
  new tokens) until all pages are migrated, so unmigrated pages don't break.
  **Do not remove this block as part of a partial migration.**
- Components with hardcoded hex via Tailwind arbitrary values (e.g.
  `src/components/Header.tsx`, `src/app/components/ui/button.tsx`) bypass the token
  system and don't respond to dark mode — these are the highest-priority migration
  targets.

---

## 10. Audit Checklist (for design-system reviews)

When reviewing a file or page, flag:

- [ ] Hardcoded hex colors (`#05B43D`, `text-[#...]`, `bg-[#...]`) instead of
      semantic tokens (`bg-primary`, `text-foreground`, `border-border`, etc.)
- [ ] Font sizes/weights outside the §4 scale, or reliance on the removed global
      `p`/`.text-sm` weight overrides
- [ ] Spacing using arbitrary px values instead of Tailwind's spacing scale
- [ ] Radius values inconsistent with §5 (e.g. `rounded-sm` on a card)
- [ ] Non-`lucide-react` icons (stray MUI/Ant icons)
- [ ] Missing or inconsistent dark-mode styling (component looks fine in light,
      breaks/clashes in `.dark`)
- [ ] Responsive gaps: fixed-width elements that overflow on mobile, missing
      `sm:`/`md:`/`lg:` variants on grids and nav
- [ ] Accessibility: insufficient contrast, missing focus-visible rings, touch
      targets under 44px

---

## Non-negotiables

Any change made under this design system MUST:

- **Not** change business logic, state management, validation, or data flow
- **Not** change API calls (`src/lib/api.ts`, `src/lib/api-config.ts`, `server/`, `api/`)
- **Not** change database code (`server/kv_store.ts`, Postgres queries)
- **Not** rename functions, props, exports, routes, or component names
- **Not** alter application behavior (what happens on click/submit/navigate)
- Only touch: Tailwind classNames, inline styles, CSS files under `src/styles/`,
  icon imports/sizes, and markup restructuring strictly for layout/responsiveness
  (wrapping elements in flex/grid containers, reordering visual blocks) while
  preserving every existing handler, prop, and functional element
- All user-visible strings continue to go through `useLanguage()` / `<T>` — do not
  add new hardcoded strings when restructuring markup
