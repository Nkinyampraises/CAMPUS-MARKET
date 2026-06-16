# UniTrade — Master Figma Redesign Prompt

> Copy everything in the box below into Figma AI / Figma Make as a single prompt to redesign the entire app.

---

```
Redesign the complete UI for "UniTrade," a student-to-student marketplace web app for university students in Cameroon (buy, sell, and rent items like books, electronics, furniture, and clothing within campus communities). The current UI is functional but plain — I need a professional, beautiful, modern, and attractive redesign across every page, while keeping all existing functionality, content, and information intact.

═══════════════════════════════════════════
DESIGN DIRECTION
═══════════════════════════════════════════
- Overall feel: premium, warm, trustworthy, modern e-commerce — clean cards, generous whitespace, soft shadows, rounded corners, subtle micro-interactions.
- Avoid generic/dated UI: no harsh borders, no flat gray backgrounds, no cramped tables. Use elevation, hierarchy, and breathing room.
- Mobile-first responsive layouts for every screen (also provide desktop versions).

COLOR PALETTE (use consistently across all screens):
- Forest Green (primary): #1B5E44 — primary buttons, active nav, headings, sidebar backgrounds
- Forest Green Dark: #134035 — hover/pressed states
- Forest Green Light: #2D7A5F — secondary buttons, highlights
- Teal (accent): #0D9488 — links, badges, icons, chart accents, CTAs
- Teal Light: #5EEAD4 — hover glows, active nav text on dark backgrounds
- Cream (background): #F5F0E8 — page background
- Cream Dark: #EDE8DC — input fills, secondary card backgrounds
- White: #FFFFFF — cards, modals, panels
- Text Primary: #1A1A1A, Text Secondary: #4A5568, Text Muted: #9CA3AF
- Status colors: Success #16A34A, Warning #D97706, Danger #DC2626, Critical #7C3AED

TYPOGRAPHY: Inter font family. Bold/Semi-bold headings, regular body text. Clear type scale (12–48px).

COMPONENTS: Rounded corners (8–16px), soft card shadows, pill-shaped buttons/badges, Lucide-style outline icons, circular avatars with teal initials fallback, smooth toggle switches, gradient-free flat surfaces with subtle elevation shadows. Currency displayed in XAF (Cameroon Franc) format throughout.

═══════════════════════════════════════════
GLOBAL LAYOUT / SHARED COMPONENTS
═══════════════════════════════════════════
1. TOP NAVIGATION BAR (all public & buyer pages): Logo ("UniTrade" in forest green with teal shield icon), centered search bar with category chips below it, right-side icons for language toggle (EN/FR), dark mode, favorites, messages, notifications (each with badge counts), and user avatar dropdown. Login/Register buttons when logged out.

2. SIDEBAR NAVIGATION (buyer dashboard, seller dashboard, admin panel): Forest green background, white text, teal-light highlight for active item, user profile block at top, grouped nav links with icons, sign-out at bottom.

3. FOOTER (public pages): Forest green background, 4-column layout (Brand/social, Explore, Account, Help), bottom bar with copyright and app store badges.

4. AI ASSISTANT WIDGET ("Sasha"): Floating teal circular button bottom-right, opens a mini chat popup with message bubbles, quick-prompt chips, and input bar.

═══════════════════════════════════════════
PAGES TO REDESIGN (organized by section)
═══════════════════════════════════════════

── PUBLIC / MARKETING ──
• Home — Hero banner with headline + CTA buttons + lifestyle image, category grid, featured/today's-deals product carousel, recently listed grid, "how it works" 3-step section, university partners band, sell-with-us CTA banner.
• Marketplace (browse listings) — Left filter sidebar (category, type, condition, price range, university, rating), top sort/result-count bar with active filter chips, responsive product card grid (image, condition badge, favorite heart, title, price, seller rating, view button), pagination.
• Item Details — Image gallery with thumbnails, product info panel (title, price, condition, location, description), buy/message-seller actions, seller profile card, tabs (description/details/reviews), related listings carousel.
• Login — Split layout: branded forest-green panel with illustration/benefits on one side, clean login form (email, password, remember me, forgot password) on the other, with 2FA OTP step.
• Register — Multi-step form (Account info → Profile/University/Student ID/Photo → Email verification with OTP), step progress indicator.
• Forgot/Reset Password — Centered card with email input, then password reset with strength meter and requirements checklist.
• Confirm Email — Centered card with pending/success/expired states.

── BUYER AREA ──
• Buyer Dashboard — Greeting header, stats cards (total spent, active orders, favorites, unread messages), recent orders table, AI-recommended products, recently viewed carousel, quick actions panel.
• Buyer Orders — Tabs (All/Pending/Processing/Completed/Cancelled), order list cards with item image, seller, status badge, price, and action buttons (view, review, dispute).
• Order Details — Order status timeline/stepper, item details card, seller info card with message button, payment info card, sidebar order summary and actions (review, report, download receipt).
• Buyer Rentals — Rental cards with rental period, duration badge, daily/weekly/monthly rates, return countdown, status (active/upcoming/expired/overdue).
• Checkout — Step 1: delivery method (campus meetup/dropoff), Step 2: payment method (MTN MoMo / Orange Money) with phone input, Step 3: confirmation; right-side order summary card; success screen with animated checkmark.
• Buyer Payments — Summary stat cards (total spent, this month, pending) + payment history table with method icons, status badges, receipt downloads.
• Buyer Receipt — Printable receipt card with zigzag divider, item breakdown, payment details, QR code, download/share buttons.
• Favorites — Product grid of saved items with filled heart icons, "remove from favorites" on hover, availability badges.
• Recently Viewed — Chronologically grouped (Today/Yesterday) product grid with "viewed X hours ago" captions.
• Review (submit) — Centered card with interactive 5-star rating, written review textarea, transaction reference, submit button with success animation.
• Messages — WhatsApp-style two-column layout: conversation list (avatars, unread badges, item context) + chat view (teal bubbles for buyer, white for seller, input bar with attach/send).
• Notifications — Grouped-by-date feed with color-coded icon circles per notification type (order/message/payment/alert/system), unread indicators.
• Profile — Cover banner + avatar, stats row (listings/sales/rating/reviews), my listings tabs, reviews with rating breakdown, personal info section.
• Settings — Left nav (Account/Security/Notifications/Privacy/Language/Payments/Danger Zone) + right content panel with forms, toggles, 2FA setup, session list.
• Help & Support — Hero search bar, FAQ category icon grid, FAQ accordion, contact options (live chat/email/WhatsApp).
• Buyer Disputes — Dispute list cards with type/status badges, "open new dispute" modal with evidence upload.
• Buyer Reports — Issue reporting interface for flagging problems with orders/listings/users.

── SELLER AREA ──
• Seller Dashboard — Stats cards (earnings, active listings, orders to fulfill, rating), earnings line/area chart, quick action cards, recent orders table, top listings carousel.
• Add/Edit Listing — Multi-section form: drag-and-drop image upload (5 slots), title/category/condition/description, sale-vs-rent toggle with pricing inputs, location/university selector, visibility settings, sticky bottom action bar (draft/preview/publish).
• Manage Listings — Filterable table/grid of seller's listings with views/favorites counts, status badges, inline edit/pause/delete actions, bulk actions.
• Seller Orders — Tabs (New/Processing/Completed/Cancelled), order cards with buyer info, payment/escrow status, action buttons (accept/confirm meetup/mark complete).
• Seller Order Details — Mirror of buyer order details but from seller's perspective with fulfillment actions.
• Seller Rentals — Rental management cards mirroring buyer rentals but for items the seller has rented out.
• Seller Reports/Analytics — Stat cards (revenue, items sold, rental income, profile views), revenue trend chart, listing performance bar chart, sales-by-category donut chart, top listings table.
• Seller Disputes — Dispute management list with status badges and response actions.
• Seller Notifications — Same notification feed pattern as buyer, seller-specific events.
• Seller Settings — Shop profile, payment/payout settings (MTN MoMo/Orange Money), listing defaults, notification preferences, vacation mode toggle.
• Seller Help — FAQ and contact support tailored to selling questions.

── ADMIN AREA ──
• Admin Dashboard (main) — Forest-green sidebar with grouped nav (Overview/Users/Content/Commerce/Moderation/Communications/System); top stat cards (total users, active listings, revenue, pending approvals); user-growth and transaction-volume charts; recent activity feed; pending approvals & flagged listings panels.
• Admin Analytics — Date-range selector, 6-stat overview row, multi-line platform growth chart, revenue donut, top-universities bar chart, category distribution chart, AI usage chart, top-sellers and high-value-transactions tables.
• User Management — Searchable/filterable user table (avatar, role badge, status badge, university, counts), bulk verify/suspend/delete actions, slide-in user detail drawer.
• Admin User Details — Full profile view with account actions and activity log.
• Admin Approvals — Queue of pending student registrations with document previews and approve/deny/request-info actions.
• Admin Inbox — Read-only view of all buyer-seller conversations for moderation, with flag/warn/remove actions.
• Admin Listings (moderation) — Listings table with flagged/removed states, detail modal with reported-by list and approve/remove actions.
• Admin Transactions — Transaction table with payment method icons, status badges, refund modal, summary stats.
• Admin Categories — Visual category card grid with icon/color pickers, drag-to-reorder, add/edit modal.
• Admin Universities — University list/table with student counts, optional Cameroon map with location pins, add/edit modal.
• Admin Payouts — Seller payout table with status badges (pending/processing/paid), batch payout actions, summary stats.
• Admin Notifications — Same notification feed pattern, admin-relevant events.
• Admin Reviews — Review moderation list with flagged-reason boxes, approve/remove/warn actions, rating stats.
• Admin Settings — Tabbed settings (General/Fees/AI Assistant/Email/Security/Maintenance) with forms and warning-highlighted destructive toggles.

── AI ASSISTANT ──
• AI Assistant ("Sasha") — Full-page chat interface: left sidebar with chat history grouped by date and daily-usage progress bar; main chat area with welcome state (suggested prompt cards), message bubbles (teal for user, white with teal accent for AI), embedded product recommendation cards within AI replies, follow-up suggestion chips, input bar with image/voice/send controls.

── OTHER ──
• Subscription/Plans — 3-tier pricing cards (Free / Pro Seller / Campus Bundle) with feature checklists, monthly/annual toggle, FAQ accordion.
• Payment Review — Pre-checkout confirmation card: order summary, selected payment method, cost breakdown table, meetup details, terms checkbox, confirm-and-pay button.
• Rental Details — Rental timeline/calendar view, rental terms card (rates/deposit/policies), condition documentation, extension request flow.

═══════════════════════════════════════════
DELIVERABLES
═══════════════════════════════════════════
For each page/section above, produce a high-fidelity redesigned screen (desktop + mobile) that:
1. Preserves all existing data fields, actions, and navigation paths listed.
2. Applies the color palette, typography, and component styles defined above consistently.
3. Improves visual hierarchy, spacing, and readability over a plain/basic layout.
4. Uses real-feeling placeholder content (student names, Cameroonian university names, XAF prices, product photos) to make the design feel authentic.
5. Maintains a cohesive design system so every screen feels part of the same product.
```

---

*This single prompt can be pasted into Figma AI / Figma Make to generate a full redesign pass. For section-by-section iteration, paste just the relevant subsection (e.g., "BUYER AREA") along with the DESIGN DIRECTION and GLOBAL LAYOUT blocks.*
