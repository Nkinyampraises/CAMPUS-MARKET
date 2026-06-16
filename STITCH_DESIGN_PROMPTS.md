# UniTrade — Stitch Design Prompts & Design System

> Copy each prompt block directly into Stitch. All pages share the same design system defined in Part 1.

---

## PART 1 — DESIGN SYSTEM

### Brand Identity
- **App Name**: UniTrade
- **Tagline**: "Buy, Sell & Rent — Within Your Campus"
- **Audience**: University students in Cameroon

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#1B5E44` | Forest green — primary actions, active nav, CTAs |
| `primary-dark` | `#134035` | Hover/pressed states |
| `primary-light` | `#2D7A5F` | Secondary buttons, highlights |
| `teal` | `#0D9488` | Accent — badges, tags, links, chart lines |
| `teal-light` | `#5EEAD4` | Hover glows, icon backgrounds |
| `cream` | `#F5F0E8` | Page background |
| `cream-dark` | `#EDE8DC` | Card backgrounds, input fills |
| `surface` | `#FFFFFF` | Cards, modals, dropdowns |
| `text-primary` | `#1A1A1A` | Headings |
| `text-secondary` | `#4A5568` | Body, labels |
| `text-muted` | `#9CA3AF` | Placeholders, captions |
| `success` | `#16A34A` | Low risk / success states |
| `warning` | `#D97706` | Moderate / warning |
| `danger` | `#DC2626` | High risk / errors |
| `critical` | `#7C3AED` | Critical alerts |
| `border` | `#E2D9CC` | Dividers, input borders |

### Typography
- **Font**: Inter (primary), fallback system-ui
- **Headings**: Inter Bold / Semi-Bold
- **Body**: Inter Regular 400
- **Scale**: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48px

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px

### Border Radius
- **sm**: 6px (inputs, badges)
- **md**: 10px (cards, buttons)
- **lg**: 16px (modals, panels)
- **xl**: 24px (hero sections)
- **full**: 9999px (pills, avatars)

### Shadows
- **card**: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- **elevated**: `0 4px 16px rgba(27,94,68,0.10)`
- **modal**: `0 20px 60px rgba(0,0,0,0.15)`

### Component Tokens

**Primary Button**: bg `#1B5E44`, text white, radius 10px, padding 12px 24px, hover `#134035`
**Secondary Button**: border `#1B5E44`, text `#1B5E44`, bg transparent, hover bg `#F0FAF5`
**Teal Button**: bg `#0D9488`, text white, hover `#0F766E`
**Danger Button**: bg `#DC2626`, text white
**Input**: bg white, border `#E2D9CC`, radius 8px, focus ring teal `#0D9488`, padding 10px 14px
**Card**: bg white, border `#E2D9CC`, radius 12px, shadow card
**Sidebar**: bg `#1B5E44`, active item bg `#134035`, text white, active text `#5EEAD4`
**Badge Low**: bg `#DCFCE7` text `#16A34A`
**Badge Moderate**: bg `#FEF3C7` text `#D97706`
**Badge High**: bg `#FEE2E2` text `#DC2626`
**Badge Critical**: bg `#EDE9FE` text `#7C3AED`
**Badge Teal**: bg `#CCFBF1` text `#0D9488`

### Layout Grid
- Desktop: 12-col, 1280px max-width, 24px gutter
- Tablet: 8-col, 768px
- Mobile: 4-col, 375px

### Icon Style
- Lucide Icons (outline style, 20px default, 24px for nav)

### Image Style
- Product images: square aspect ratio, white bg, subtle shadow
- Hero images: warm-toned lifestyle photography of students
- Avatars: circular, initials fallback with teal bg

---

## PART 2 — SHARED LAYOUT COMPONENTS

---

### PROMPT: Header / Navigation Bar

```
Design a responsive top navigation bar for "UniTrade," a student marketplace app.

COLORS: Background white, border-bottom 1px #E2D9CC, logo text #1B5E44 (forest green).

LEFT SIDE:
- Logo: shield icon in teal (#0D9488) + bold "UniTrade" text in forest green
- Below logo on mobile: collapsible hamburger menu

CENTER:
- Search bar: full-width rounded pill input, placeholder "Search listings, categories...", magnifier icon in teal on right, bg #F5F0E8 (cream), border #E2D9CC
- Below search: horizontal category chips (Books, Electronics, Furniture, Clothing, Kitchen...) in small pill badges — bg cream, active bg teal text white

RIGHT SIDE (desktop):
- Language toggle: EN | FR small text links
- Dark mode toggle icon button
- Favorites icon (heart) with red badge count
- Messages icon (chat bubble) with green badge count
- Notifications bell with orange badge count
- User avatar circle (teal initials) with dropdown arrow
- If logged out: "Login" ghost button + "Register" filled teal button

MOBILE: Show only logo, search icon, and hamburger. Expand to full drawer on click.

Style: Clean, minimal, no gradients. Sticky position. White surface. Height 64px desktop.
```

---

### PROMPT: Footer

```
Design a multi-column footer for "UniTrade" student marketplace.

COLORS: Background #1B5E44 (forest green), text white/cream, links #5EEAD4 (teal-light).

LAYOUT (4 columns on desktop, stacked on mobile):
Column 1 — Brand:
- Logo (shield + "UniTrade" in white)
- Tagline: "The student marketplace for Cameroonian universities"
- Social icons: Facebook, Instagram, Twitter, WhatsApp (white icons, teal hover)

Column 2 — Explore:
- Browse Marketplace, Today's Deals, Categories, Universities, Rent Items

Column 3 — Account:
- Login, Register, My Dashboard, Sell an Item, My Orders

Column 4 — Help:
- Help & Support, Report an Issue, Privacy Policy, Terms of Service, Contact Us

BOTTOM BAR:
- Copyright "© 2026 UniTrade. All rights reserved."
- App store badges (App Store, Google Play) side by side
- Currency: XAF (CFA Franc) display note

Style: Dense but breathable. Forest green background. Teal accent links. Cream/white text hierarchy.
```

---

### PROMPT: AI Assistant Launcher Widget

```
Design a floating AI assistant launcher button fixed to the bottom-right corner of the screen.

COLORS: Button bg teal (#0D9488), icon white, shadow elevated green.

CLOSED STATE:
- Circular FAB button, 56px, teal background
- Sparkle/robot icon in white
- Subtle pulse animation ring in teal-light
- Small tooltip on hover: "Chat with Sasha, your AI assistant"

OPEN STATE (mini chat popup above button):
- Card 320px wide, 420px tall, bg white, radius 16px, shadow modal
- Header: teal bg, "Sasha — AI Assistant" white text, avatar icon left, X close button right
- Message area: scrollable, user messages right-aligned (teal bubble), AI messages left-aligned (cream bubble)
- Input bar at bottom: text input + send button (teal icon)
- Suggested quick prompts as chips above input: "Find me a laptop", "How do I sell?", "Check my orders"

Style: Premium, friendly, non-intrusive. Should not cover main content on mobile.
```

---

## PART 3 — PUBLIC PAGES

---

### PROMPT: Home Page (Landing)

```
Design a modern e-commerce homepage for "UniTrade," a student marketplace for Cameroonian universities. Inspired by Amazon's structure but with a premium, clean aesthetic.

COLORS: Page bg #F5F0E8 (cream), primary #1B5E44 (forest green), accent #0D9488 (teal), cards white.

SECTION 1 — Hero Banner (full-width):
- Split layout: LEFT has bold headline "Buy, Sell & Rent Within Your Campus" in forest green, subtext in gray, two CTA buttons: "Browse Marketplace" (teal filled) and "Start Selling" (forest green outlined)
- RIGHT: lifestyle image of African university students exchanging goods, warm toned, rounded-xl
- Behind text: subtle cream-to-white gradient
- Below headline: 3 trust badges inline — "2,400+ Students", "50+ Universities", "Free to List"

SECTION 2 — Category Grid:
- Section header: "Shop by Category" left-aligned bold, "View All →" teal link right
- 6-8 category cards in horizontal scroll on mobile, 4-col grid on desktop
- Each card: square, white bg, rounded-xl, centered icon (teal), category name below, subtle hover lift shadow
- Categories: Books, Electronics, Furniture, Kitchen, Clothing, Sports, Stationery, Appliances

SECTION 3 — Featured Listings (Today's Deals):
- Section header with countdown timer badge "Deals end in 02:45:30"
- Horizontal scroll row of product cards
- Each product card: white bg, rounded-xl, product image top (aspect square), condition badge top-left (green "New" / orange "Used"), favorite heart top-right, item name, price in bold forest green (XAF format), seller avatar + name + rating stars below, "View Item" teal button

SECTION 4 — Recently Listed (Latest Additions):
- 4-col grid of product cards (same card style as above)
- Section header: "Just Added" with teal dot badge

SECTION 5 — How It Works:
- 3 steps horizontal: 1. Find Items, 2. Contact Seller, 3. Pay Safely
- Each step: numbered circle (teal), icon, title bold, 1-line description
- Background: white band with subtle forest green top border

SECTION 6 — Universities Banner:
- Headline: "Available at 50+ Universities in Cameroon"
- Scrolling logo row of university names/badges on cream background

SECTION 7 — Sell CTA Banner:
- Full-width card, forest green background, white text
- "Have something to sell? List it for free in 2 minutes"
- "Start Selling →" cream/white button

Style: Warm, trustworthy, Amazon-inspired grid layout but more premium. Heavy use of white cards on cream background. Forest green headings and teal CTAs throughout.
```

---

### PROMPT: Marketplace Page (Browse Listings)

```
Design a marketplace browsing page for "UniTrade." Reference: Amazon product listing page + modern filtering sidebar.

COLORS: Page bg #F5F0E8, sidebar bg white, cards white, primary #1B5E44, accent teal.

LAYOUT: 2-column — left sidebar 260px fixed, right content area flex.

LEFT SIDEBAR (Filters):
- "Filters" header with "Clear All" teal link
- Collapsible filter sections with chevron toggle:
  1. Category (checkbox list): Books, Electronics, Furniture, Clothing, Kitchen...
  2. Listing Type: Sell | Rent (radio toggle pills)
  3. Condition: New, Like New, Good, Fair (checkbox)
  4. Price Range: dual-handle range slider in teal, min/max inputs
  5. University: searchable dropdown multi-select
  6. Rating: star filter (4★ and above, etc.)
- Apply Filters button (forest green, full width)

TOP BAR (above results):
- Left: "Showing 148 results for 'electronics'" text
- Right: Sort dropdown (Newest, Price Low-High, Price High-Low, Most Popular), and View toggle (grid/list icons)
- Active filter chips below: "Electronics ×", "Under 50,000 XAF ×"

PRODUCT GRID (3 col desktop, 2 col tablet, 1 col mobile):
Each card:
- White bg, rounded-xl, shadow card
- Product image top (aspect square, object-fit cover, white bg fallback)
- Top-left: condition badge (green "New" / amber "Used")
- Top-right: heart (favorite) icon button
- Padding section: item title (bold, 2-line clamp), category tag (teal pill), price (large, forest green, XAF format), original price strikethrough if discounted
- Bottom: seller row — avatar circle, seller name, star rating (gold stars + count), "View" arrow button (teal)
- Hover: lift shadow, slight scale-up

EMPTY STATE: Illustration of empty box, "No listings found. Try adjusting your filters."

PAGINATION: Page number buttons at bottom, previous/next, teal active page.

Style: Clean Amazon-like product grid. Cream page bg makes white cards pop. Teal and forest green for all interactive elements.
```

---

### PROMPT: Item Details Page

```
Design a product detail page for "UniTrade" marketplace. Reference: Amazon product detail page, modern and clean.

COLORS: Page bg cream #F5F0E8, white panels, forest green #1B5E44, teal #0D9488.

TOP SECTION (2-col layout):
LEFT — Image Gallery:
- Large main image (square, white bg, rounded-xl, shadow)
- Row of 4 thumbnail images below, click to switch main
- Condition badge overlay top-left: "Like New" in amber
- Zoom-on-hover effect on main image

RIGHT — Product Info:
- Breadcrumb: Home > Electronics > Laptops
- Title: Large bold heading (forest green)
- Rating row: gold stars, review count link, "Verified Student" seller badge (teal)
- Price: very large font, forest green, XAF format. If rental: show "per day / per week / per month"
- Listing type badge: "FOR SALE" or "FOR RENT" teal pill
- Divider line
- Description: body text, expandable "Read more" if long
- Condition row: label + value in badge
- Location: pin icon + university name
- Posted date: small muted text
- ACTION AREA:
  - Quantity selector (if applicable)
  - "Buy Now" button — forest green, full width, large
  - "Message Seller" button — teal outlined, full width
  - "Add to Favorites" — heart icon button + count
  - "Share" icon button

SELLER CARD (below actions or sidebar):
- White card, rounded-xl
- Seller avatar (large circle), name bold, "Verified Student" badge
- Star rating average + total reviews
- Member since date
- Stats: Total sales, Response rate
- "View Profile" ghost link
- "Message Seller" teal button

TABS SECTION (below main):
- Tab 1: Description — full formatted text
- Tab 2: Details — table of specs (Condition, Category, University, Posted)
- Tab 3: Reviews — list of buyer reviews with stars, text, date, reviewer name

RELATED LISTINGS (below tabs):
- "You May Also Like" section header
- Horizontal scroll row of 5 product cards (same card design as marketplace)

Style: Generous whitespace. Forest green for price and headings. Teal for interactive elements. Warm cream page bg.
```

---

### PROMPT: Login Page

```
Design a login page for "UniTrade" student marketplace.

COLORS: Left panel bg #1B5E44 (forest green), right panel bg white, accent teal #0D9488.

LAYOUT: Split screen — left 40%, right 60% (full screen on mobile).

LEFT PANEL (decorative, forest green):
- Logo top: shield icon + "UniTrade" in white
- Tagline: "Your campus. Your marketplace."
- Illustration: stylized students trading items, warm tones, semi-transparent overlay
- 3 bullet points with checkmark icons:
  - "Buy from verified students"
  - "Sell in 2 minutes"
  - "Rent what you need"
- Bottom: university partner logos in white/faded

RIGHT PANEL (form):
- Top: "Welcome back" heading bold in forest green
- Subtext: "Sign in to your UniTrade account"
- "OR continue with" social row (optional, placeholder)
- Divider with "or"
- Email input: label "Email Address", full-width, rounded-lg
- Password input: label "Password", eye toggle icon, full-width
- Row: "Remember me" checkbox left, "Forgot password?" teal link right
- "Sign In" button: full-width, large, forest green bg, white text
- Divider
- "Don't have an account?" text + "Register here" teal bold link

ERROR STATE: Red banner above form with error message icon.
2FA STATE: After login, show 6-digit OTP input screen with resend option.

Style: Professional, welcoming. Green/teal trust signals. Minimal form on clean white right panel.
```

---

### PROMPT: Register Page

```
Design a multi-step registration page for "UniTrade."

COLORS: Same split layout as Login page — forest green left panel, white right panel.

STEP INDICATOR (top of right panel):
- 3 step pills: "1. Account" → "2. Profile" → "3. Verify"
- Active: forest green filled. Completed: teal with checkmark. Pending: gray.

STEP 1 — Account Info:
- Full Name input
- Email input
- Password input (strength indicator bar below: weak red → strong green)
- Confirm Password input
- "Next: Profile →" forest green button

STEP 2 — Student Profile:
- University selector: searchable dropdown with all Cameroon universities
- Student ID input
- Phone number input (with +237 country prefix)
- Profile photo upload: drag-and-drop area, dashed border teal, "Upload Photo" text + camera icon
- Role selection: "I want to Buy" | "I want to Sell" | "Both" — toggle card selection
- "← Back" ghost + "Next: Verify →" green button

STEP 3 — Email Verification:
- Icon: envelope illustration in teal
- "Check your email" heading
- "We sent a 6-digit code to ghislain@email.com"
- 6 individual OTP digit input boxes (teal focus border, large font)
- "Verify Email" button (forest green, full width)
- "Didn't receive it? Resend code" teal link with countdown timer

LEFT PANEL: Show progress ("Step 2 of 3") and encouraging messages per step.

Style: Clean, progress-driven, student-friendly. Encourage completion with step progress visual.
```

---

### PROMPT: Forgot Password / Reset Password Pages

```
Design two related pages for password recovery in "UniTrade."

PAGE 1 — Forgot Password:
LAYOUT: Centered card on cream bg, max-width 440px, white card, rounded-xl, shadow.
- Back arrow link top-left
- Lock icon in teal, 48px, centered
- "Forgot your password?" heading bold forest green
- Subtext: "Enter your email and we'll send you a reset link."
- Email input full-width
- "Send Reset Link" forest green button full-width
- "Remember it? Sign in →" muted link below

PAGE 2 — Reset Password (after clicking email link):
LAYOUT: Same centered card.
- Shield-check icon in teal, centered
- "Create new password" heading
- New Password input with strength bar
- Confirm Password input
- Password requirements checklist (animated checkmarks as criteria met):
  - ✓ At least 8 characters
  - ✓ One uppercase letter
  - ✓ One number
  - ✓ One special character
- "Update Password" forest green button
- Success state: green checkmark animation + "Password updated! Redirecting to login..."

Style: Minimal, reassuring. Centered card on cream bg. Teal icons, forest green CTAs.
```

---

### PROMPT: Confirm Email Page

```
Design an email confirmation page for "UniTrade."

LAYOUT: Centered on cream page bg, white card 440px, rounded-xl.

STATES:

PENDING:
- Envelope illustration with sparkles, teal color
- "Confirm your email" heading forest green
- "Click the link in your email to activate your account"
- Resend button (teal outlined)
- Countdown: "Resend available in 0:45"

SUCCESS:
- Animated checkmark circle (forest green fill, white check)
- "Email confirmed!" heading
- "Your account is now active. Welcome to UniTrade!"
- "Go to Dashboard →" forest green button

EXPIRED:
- Warning icon in amber
- "This link has expired"
- "Request a new confirmation link" teal button

Style: Simple, celebratory on success. Cream bg, white card, teal and green accents.
```

---

## PART 4 — BUYER PAGES

---

### PROMPT: Buyer Dashboard

```
Design a buyer dashboard for "UniTrade" logged-in student.

COLORS: Page bg cream #F5F0E8, sidebar forest green, content area cream, white cards.

LAYOUT: Left sidebar 240px (forest green) + main content area.

SIDEBAR:
- User avatar (large circle teal initials) + name + "Student Buyer" badge
- University name with pin icon in teal-light
- Nav links (white icons + text, active item bg #134035, active text teal-light):
  - Dashboard (home icon)
  - Browse Marketplace
  - My Orders
  - My Rentals
  - Payments
  - Favorites
  - Recently Viewed
  - Messages
  - Reviews
  - Help & Support
  - Settings
  - Sign Out

MAIN CONTENT:
- Top greeting: "Good morning, Ghislain! 👋" (heading), date below
- Stats row (4 cards white):
  - Total Spent: big number XAF, arrow icon teal
  - Active Orders: count, amber icon
  - Items Favorited: count, red heart icon
  - Messages Unread: count, teal chat icon
- "Recent Orders" section:
  - Table with: item image thumbnail, item name, seller, date, status badge (Pending/Completed/Cancelled), price, action button
  - "View All Orders →" teal link
- "Recommended for You" section:
  - AI-powered: 4 product cards in grid (same card style)
  - Subtext: "Based on your browsing history"
- "Recently Viewed" section:
  - Horizontal scroll row of small product cards
- Right column (sidebar panel):
  - Quick Actions card: "Browse Listings", "Message a Seller", "View Wishlist" as button links
  - Unread Messages preview card: last 3 messages with avatar, snippet, time

Style: Warm, organized dashboard. Forest green sidebar. White stats cards on cream bg. Teal accents throughout.
```

---

### PROMPT: Buyer Orders Page

```
Design a buyer orders management page for "UniTrade."

COLORS: Cream bg, white panels, forest green, teal accents.

PAGE HEADER:
- "My Orders" heading bold forest green
- Tabs: All | Pending | Processing | Completed | Cancelled
- Search orders input + Date range filter right-side

ORDER LIST:
Each order row (white card, rounded-xl, shadow):
- Left: product image (60px square, rounded-lg)
- Center:
  - Item name bold + category tag
  - Seller: avatar + name
  - Order date and reference number (#ORD-2026-0042 format)
  - Delivery type badge: "Meetup" or "Pickup"
- Right:
  - Status badge (color-coded):
    - Pending: amber
    - Processing: teal
    - Completed: green
    - Cancelled: red
  - Price in forest green bold XAF format
  - Action buttons: "View Details" (teal) | "Leave Review" (outlined green, shows if completed) | "Dispute" (outlined red, shows if issue)

EMPTY STATE: Cart illustration, "No orders yet. Browse the marketplace to find something!"

SUMMARY CARD (top or sidebar):
- Total spent this month: XAF amount
- Orders this month: count
- Completed: count
- Pending: count

Style: Clean table-card hybrid. Status badges color-coded. Full-width on desktop, stacked cards on mobile.
```

---

### PROMPT: Order Details Page

```
Design an individual order details page for "UniTrade" buyer.

COLORS: Cream bg, white cards, forest green, teal.

BREADCRUMB: My Orders > Order #ORD-2026-0042

PAGE LAYOUT: 2-col (main 65% + sidebar 35%).

MAIN COLUMN:
CARD 1 — Order Status Timeline:
- Horizontal or vertical stepper:
  1. Order Placed (checkmark teal)
  2. Seller Confirmed (checkmark teal)
  3. Meetup Scheduled (active, pulsing dot green)
  4. Completed (gray, pending)
- Each step: icon, label, timestamp, brief description

CARD 2 — Item Details:
- Product image (120px), item name bold, category, condition badge
- Price paid, quantity, subtotal
- Description excerpt
- "View Listing →" teal link

CARD 3 — Seller Info:
- Avatar, seller name, rating, phone (if meetup)
- "Message Seller" teal button
- Meetup location (if scheduled): map pin icon + address/campus location

CARD 4 — Payment Info:
- Payment method icon (MTN MoMo / Orange Money logo)
- Reference number
- Amount paid XAF
- Platform fee
- Date paid

SIDEBAR:
CARD — Order Summary:
- Reference: #ORD-2026-0042
- Status badge (large, prominent)
- Date: Jun 14, 2026
- Subtotal, fees, total paid breakdown table

CARD — Actions:
- "Leave a Review" (forest green, if completed)
- "Report an Issue" (red outlined)
- "Download Receipt" (teal outlined, PDF icon)
- "Cancel Order" (red text link, if pending)

Style: Detailed but scannable. Timeline is the hero element. Two-column layout with summary sidebar.
```

---

### PROMPT: Buyer Rentals Page

```
Design a rentals management page for buyers in "UniTrade."

Same layout as Orders page but adapted for rentals.

COLORS: Cream bg, white cards, forest green, teal.

TABS: All Rentals | Active | Upcoming | Expired

Each rental card:
- Product image + item name + category
- Rental period: "Jun 10 – Jun 20, 2026" with calendar icon
- Duration badge: "10 days" in teal pill
- Daily/weekly rate shown
- Total rental cost XAF
- Status badge: Active (teal), Upcoming (amber), Expired (gray), Overdue (red)
- Return countdown: "Due in 3 days" warning if approaching
- Action buttons: "View Details", "Request Extension", "Report Issue"

ACTIVE RENTALS highlighted with teal left border on card.

OVERDUE RENTALS highlighted with red left border + warning banner.

Style: Calendar-awareness. Duration pills in teal. Clear visual hierarchy for active vs expired.
```

---

### PROMPT: Checkout Page

```
Design a checkout/payment flow page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal.

LAYOUT: 2-col — left 60% form, right 40% summary.

LEFT — Checkout Form:
STEP 1: Delivery Method
- Card toggle selection:
  - "Campus Meetup" (recommended) — icon of two people, description text
  - "Seller Dropoff" — delivery icon
- If Meetup: Location selector (campus map picker or dropdown), preferred time slots

STEP 2: Payment Method
- Payment method cards (selectable):
  - MTN Mobile Money — orange logo icon, input for phone number
  - Orange Money — orange logo, phone input
  - (Future: Card payment placeholder grayed out "Coming soon")
- Phone number input with +237 prefix
- "Pay securely via mobile money" trust text with lock icon

STEP 3: Confirmation
- Summary table of what you're paying for
- Terms checkbox: "I agree to the Terms of Service"
- "Complete Purchase" — large forest green button full-width

RIGHT — Order Summary Card:
- Product image + name + condition
- Seller name
- Price breakdown:
  - Item price: X XAF
  - Platform fee: X XAF
  - Total: bold forest green, large
- "Secure Checkout" badge (shield + lock icon, teal)
- Estimated confirmation: "Within 24 hours"

PAYMENT SUCCESS STATE:
- Full-page overlay or new page
- Animated checkmark (forest green circle, white check)
- "Payment Submitted!"
- Reference: #PAY-2026-0099
- "Your seller has been notified. Check your messages."
- "View Order" teal button + "Back to Marketplace" ghost link

Style: Trust-building. Clear 3-step process. MTN/Orange Money feel native to the UX.
```

---

### PROMPT: Buyer Payments Page

```
Design a payment history page for "UniTrade" buyers.

COLORS: Cream bg, white cards, forest green, teal.

PAGE HEADER: "Payment History" heading + export CSV button right

SUMMARY STATS (3 cards):
- Total Spent (XAF): large number, upward trend icon
- This Month: XAF amount
- Pending Transactions: count in amber

PAYMENTS TABLE:
Columns: Date | Reference | Item | Payment Method | Amount | Status | Receipt
- Date: formatted "Jun 14, 2026"
- Reference: monospaced pill (#PAY-...)
- Item: thumbnail + name
- Method: MTN MoMo / Orange Money logo icon + text
- Amount: XAF bold
- Status: Success (green), Pending (amber), Failed (red), Refunded (blue)
- Receipt: download PDF icon button

FILTER BAR above table: date range picker, status filter dropdown, method filter dropdown.

EMPTY STATE: Receipt illustration, "No payments yet."

Style: Financial clarity. Clean table on white card. Color-coded statuses.
```

---

### PROMPT: Buyer Receipt Page

```
Design a printable/shareable receipt page for "UniTrade."

COLORS: White page (print-friendly), forest green accents, teal.

RECEIPT CARD (max-width 600px, centered, white bg, shadow):

HEADER:
- UniTrade logo left + "RECEIPT" label right in teal
- Reference: #RCP-2026-0099
- Date issued: Jun 14, 2026

DIVIDER with zigzag edge (receipt-style)

ITEMS SECTION:
- Product image + name + condition
- Quantity x price breakdown
- Subtotal
- Platform fee
- TOTAL: bold large forest green, XAF format

PAYMENT DETAILS:
- Method: MTN MoMo icon + phone number used
- Transaction ID: monospace
- Status: PAID badge (green filled)

PARTIES:
- Buyer: name + email
- Seller: name + university

FOOTER:
- "Thank you for using UniTrade"
- QR code placeholder (verification)
- "Download PDF" + "Share" button (teal)

PRINT BUTTON: fixed bottom bar when viewing in browser

Style: Actual receipt aesthetic. Zigzag divider. Clean, printable.
```

---

### PROMPT: Favorites Page

```
Design a saved/favorites page for "UniTrade" buyers.

COLORS: Cream bg, white cards, forest green, teal.

PAGE HEADER: "My Favorites" heading + count badge (teal pill "24 items") + sort dropdown

FILTER ROW: All | For Sale | For Rent | by Category

PRODUCT GRID (same card style as Marketplace):
- Product image, item name, price, seller, condition
- Red heart icon top-right (filled, since it's a favorite)
- "Remove from Favorites" on hover overlay
- Status badge: "Still Available" (green) or "Sold Out" (gray strikethrough)

EMPTY STATE:
- Heart outline illustration in teal
- "No favorites yet"
- "Start browsing the marketplace to save items you love"
- "Browse Now" teal button

Style: Same grid as marketplace. Heart icon is the main UI differentiator.
```

---

### PROMPT: Recently Viewed Page

```
Design a recently viewed items page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal.

PAGE HEADER: "Recently Viewed" + "Clear History" red text link right

CHRONOLOGICAL SECTIONS:
- "Today" header
- Grid of 4 product cards
- "Yesterday" header
- Grid of 4 product cards

Each card: same marketplace card style + small "Viewed X hours ago" caption in muted text.

Available/Sold status badge overlay.

EMPTY STATE:
- Eye icon illustration
- "Your browsing history is empty"
- "Browse Marketplace →" teal button

Style: Simple, clean. Chronological grouping helps orientation.
```

---

### PROMPT: Review Submission Page

```
Design a product review submission page for "UniTrade" buyers.

COLORS: Cream bg, white card, forest green, teal.

CENTERED CARD (max-width 560px):
- Back arrow link
- "Leave a Review" heading bold forest green
- Item being reviewed:
  - Product image (60px) + name + "Seller: Amara K." inline row

REVIEW FORM:
- Star rating: 5 large interactive stars (click to select), gold filled on select, teal hover state
- Selected rating label: "Great! (4 stars)" in teal text
- Written review textarea:
  - Label: "Tell us about your experience"
  - Placeholder: "Was the item as described? How was the seller communication?"
  - Character counter: 0/500
- Transaction reference shown (auto-filled, read-only)
- "Submit Review" forest green button + "Skip for now" gray link

SUCCESS STATE:
- Animated star burst (gold)
- "Review submitted! Thank you."
- "Back to Orders" teal button

Style: Simple, encouraging. Large interactive stars are the hero element.
```

---

### PROMPT: Messages Page

```
Design a messaging page for "UniTrade" buyer-seller communications. Reference: WhatsApp Web / iMessage layout.

COLORS: Cream bg, left panel white, right panel cream, forest green, teal.

LAYOUT: 2-col — left conversation list 320px, right chat view flex.

LEFT — Conversation List:
- "Messages" heading + compose/new icon button
- Search conversations input
- Conversation items (white hover bg, active bg cream/teal-tinted):
  - Seller avatar (circle with initials)
  - Seller name bold + item name small gray
  - Last message preview truncated
  - Timestamp small right
  - Unread count badge (teal circle, white number)
  - "Re: [Item Name]" sub-label under name

RIGHT — Chat View:
- Chat header: seller avatar + name + "Re: MacBook Pro" item context + "View Item →" link + phone/more icons right
- Message area: scrollable
  - Buyer messages: right-aligned, teal bg, white text, rounded-tl-xl rounded-l-xl
  - Seller messages: left-aligned, white bg, dark text, rounded-tr-xl rounded-r-xl
  - Timestamp below each message in muted small text
  - System message (center): "Offer for MacBook Pro sent" — gray pill
- Input area (white bar bottom):
  - Paperclip icon (attach)
  - Text input full-width: "Type a message..."
  - Send button teal circle icon

EMPTY STATE (no conversation selected): Chat bubble illustration, "Select a conversation to start messaging"

MOBILE: Full screen list view → tap to open full screen chat → back arrow returns to list

Style: WhatsApp Web-inspired. Clean, familiar messaging UI. Teal = buyer, white = seller.
```

---

### PROMPT: Notifications Page

```
Design a notifications page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal.

PAGE HEADER: "Notifications" heading + "Mark All Read" teal link + filter (All | Unread | Orders | Messages | System)

NOTIFICATION LIST:
Each notification item (white card, rounded-lg):
- Left: colored icon circle:
  - Order: forest green bg, shopping bag icon
  - Message: teal bg, chat icon
  - Payment: amber bg, money icon
  - Alert: red bg, bell icon
  - System: gray bg, info icon
- Center: notification text (bold title + body description), timestamp small muted
- Right: unread dot (teal) if unread
- Unread notifications have subtle teal-tinted left border or bg

GROUPED BY DATE: "Today", "Yesterday", "This Week"

EMPTY STATE:
- Bell outline illustration in teal
- "All caught up! No new notifications."

Style: Clean feed. Color-coded icon circles. Teal = unread signal.
```

---

### PROMPT: User Profile Page

```
Design a user profile page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal.

PROFILE HEADER (wide white card):
- Cover area: forest green gradient bg, subtle pattern
- Avatar: large circle (100px), white border, positioned center/left at bottom of cover
- Below avatar: display name bold large, "@username" handle muted
- Badges row: "Verified Student" (teal), university name with building icon, "Member since 2025"
- Stats row: Total Listings | Total Sales | Rating (stars) | Reviews Count — each in small stat block
- "Edit Profile" button (forest green, top-right of card)

MY LISTINGS SECTION:
- Tab: Active Listings | Sold | Rented Out
- Grid of seller's items (same product cards)
- "Add New Listing +" teal button

MY REVIEWS SECTION:
- Rating breakdown: 4.8/5 large, star bars showing distribution (5★, 4★, etc.)
- Review cards: avatar, name, stars, date, text body

PERSONAL INFO SECTION (below, in 2-col card):
- Email (partially masked)
- Phone
- University
- Student ID (masked)
- "Edit Info" teal link

Style: Professional seller/buyer profile. Cover image area with avatar positioned over it.
```

---

### PROMPT: Settings Page

```
Design a user settings page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal.

LAYOUT: Left nav list 220px + right content panel.

LEFT NAV (stacked links, active = teal left border + text):
- Account
- Security & Password
- Notifications
- Privacy
- Language & Region
- Payments
- Danger Zone

RIGHT CONTENT PANELS (per selected section):

ACCOUNT SETTINGS:
- Avatar upload with edit overlay
- Full name, email, phone inputs
- University selector
- Student ID
- "Save Changes" green button

SECURITY:
- Current Password + New Password + Confirm inputs
- 2FA section: toggle enable/disable, QR code if enabled
- Login sessions list (device, location, last active) + "Revoke" buttons

NOTIFICATIONS (toggle switches):
- Email Notifications: Order updates, Messages, Deals, Newsletter
- Push Notifications: same categories
- Toggle style: forest green when on, gray when off

LANGUAGE:
- Language selector: English / Français (card-style toggle)
- Currency: XAF (read-only info)

DANGER ZONE (red-tinted section):
- "Deactivate Account" outlined red button
- "Delete Account" filled red button
- Warning text below each

Style: Clean settings UI. Left nav with content panel. Toggle switches for notifications.
```

---

### PROMPT: Help & Support Page

```
Design a help and support page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal.

HERO SECTION:
- Heading: "How can we help you?"
- Large search bar centered: "Search for answers..." with magnifier icon teal
- Common searches chips below: "How to sell", "Payment issues", "Cancel order", "Verify account"

FAQ CATEGORIES (icon grid 3-col):
- Buying & Orders (shopping bag icon, teal)
- Selling & Listings (tag icon, forest green)
- Payments (wallet icon, amber)
- Account & Security (shield icon, blue)
- Rentals (key icon, purple)
- Disputes (balance scale icon, red)

FAQ ACCORDION (below):
- Each question expands on click (chevron icon)
- Answers in body text, links styled teal

CONTACT SECTION (bottom):
- 3 contact option cards:
  - Live Chat: chat icon, "Available 9am-6pm", teal button "Start Chat"
  - Email: envelope icon, "Reply within 24hrs", ghost button "Send Email"
  - WhatsApp: whatsapp icon green, "Quick responses", ghost button "Chat on WhatsApp"

Style: Self-service first. Big search bar hero. FAQ accordion. Clean contact cards at bottom.
```

---

### PROMPT: Buyer Disputes Page

```
Design a disputes/issues page for buyers in "UniTrade."

COLORS: Cream bg, white cards, forest green, teal, red for dispute status.

PAGE HEADER: "My Disputes" heading + "Open New Dispute" red button right

DISPUTE LIST:
Each dispute card (white, rounded-xl):
- Dispute ID + date
- Item involved: thumbnail + name + order reference
- Dispute type badge: "Item not as described" / "No-show seller" / "Payment issue"
- Status badge: Open (red), Under Review (amber), Resolved (green), Closed (gray)
- Brief description excerpt
- "View Details" teal link + "Upload Evidence" ghost button

OPEN NEW DISPUTE MODAL:
- Order selector dropdown
- Dispute type select
- Description textarea
- Evidence upload (multiple images/files)
- "Submit Dispute" red button

EMPTY STATE: Balance scale illustration, "No disputes filed. Transactions going smoothly!"

Style: Professional dispute management. Red for open disputes. Status badges clearly color-coded.
```

---

## PART 5 — SELLER PAGES

---

### PROMPT: Seller Dashboard

```
Design a seller dashboard for "UniTrade."

COLORS: Forest green sidebar, cream bg, white cards, teal accents.

SIDEBAR (same forest green sidebar as Buyer but with Seller nav):
- Dashboard
- My Listings
- Add New Listing
- Orders Received
- Rentals
- Earnings & Payouts
- Disputes
- Reviews
- Notifications
- Settings
- Help
- Sign Out

MAIN CONTENT:
STATS ROW (4 white cards):
- Total Earnings: XAF, green upward arrow
- Active Listings: count, teal icon
- Orders to Fulfill: count, amber warning icon
- Rating: stars, gold icon

EARNINGS CHART:
- Line chart: "Earnings — Last 30 Days"
- Teal fill-area chart, x-axis days, y-axis XAF
- Hover tooltip: exact amount per day

QUICK ACTIONS (3 card row):
- "Add New Listing" (forest green, plus icon)
- "View Pending Orders" (teal, bag icon)
- "Check Messages" (outlined, chat icon)

RECENT ORDERS TABLE:
- Buyer, Item, Date, Amount, Status, Action
- Same style as buyer orders but columns from seller POV

MY TOP LISTINGS (horizontal scroll):
- Top 4 performing listings by views/orders, with mini stats

Style: Sales-focused dashboard. Earnings chart is hero element. Forest green sidebar drives focus.
```

---

### PROMPT: Add Listing / Edit Listing Page

```
Design an add/edit listing page for sellers in "UniTrade."

COLORS: Cream bg, white form card, forest green, teal.

PAGE HEADER: "Create New Listing" or "Edit Listing" + breadcrumb

MULTI-SECTION FORM (single page, scrollable):

SECTION 1 — Images (top):
- Drag-and-drop image upload area: dashed border teal, cloud upload icon, "Drop images here or click to browse"
- Image preview grid: 5 slots, first slot = "Main Photo" labeled, reorderable
- Delete X on each preview
- "Up to 5 images, 5MB each" hint text

SECTION 2 — Basic Info:
- Title input (label + char counter 80)
- Category dropdown (searchable)
- Condition select: New | Like New | Good | Fair (card button toggle)
- Description textarea (label + char counter 2000) with formatting hint

SECTION 3 — Listing Type:
- Toggle: "For Sale" | "For Rent" | "Both" — pill tab toggle
- IF SALE: Price input (XAF) + "Original Price" for discount (optional)
- IF RENT: Daily rate + Weekly rate + Monthly rate inputs, Min/Max rental period

SECTION 4 — Location:
- University dropdown (where to meetup)
- Specific location/building (text input)

SECTION 5 — Settings:
- Allow direct messages toggle
- Visible to all universities / My university only toggle

FORM ACTIONS (sticky bottom bar):
- "Save as Draft" ghost button
- "Preview Listing" ghost teal button
- "Publish Listing" forest green filled button large

PREVIEW MODAL: shows exactly how listing looks on marketplace.

Style: Step-by-step sections within single scrollable form. Image upload is the hero. Sticky bottom action bar.
```

---

### PROMPT: Manage Listings Page

```
Design a seller's manage listings page for "UniTrade."

COLORS: Cream bg, white table/cards, forest green, teal.

PAGE HEADER: "My Listings" + "Add New Listing" forest green button

FILTER/SORT BAR:
- Tab filter: All | Active | Drafts | Sold | Rented
- Sort: Newest | Most Viewed | Price High-Low
- Search listings input

LISTINGS TABLE (or card grid, toggle):
Each row/card:
- Product thumbnail (50px)
- Item name + category
- Listing type badge (Sale/Rent)
- Views count (eye icon + number)
- Favorites count (heart + number)
- Status badge (Active/Draft/Sold/Rented)
- Price XAF
- Date posted
- Actions: Edit (pencil icon), Pause/Activate (toggle), Delete (trash icon red)

BULK ACTIONS (appear when rows selected via checkbox):
- "Delete Selected" red button
- "Deactivate Selected" amber button

EMPTY STATE: Plus circle illustration, "No listings yet. Create your first listing!"

Style: Data table with inline actions. Bulk selection support. Clean, seller-focused.
```

---

### PROMPT: Seller Orders Page

```
Design a seller's incoming orders page for "UniTrade."

Same structure as buyer orders but from seller's perspective.

COLORS: Cream bg, white cards, forest green, teal.

TABS: All | New Orders | Processing | Completed | Cancelled

Each order card:
- Buyer avatar + name
- Item: thumbnail + name
- Order date + reference number
- Meetup/delivery arrangement
- Payment status: Pending Escrow / Released / Refunded
- Status badge
- Actions:
  - "Accept Order" green (if new)
  - "Confirm Meetup" teal (if accepted)
  - "Mark Complete" green (after meetup)
  - "View Details" ghost

URGENT ORDERS: red left border + "Action required" amber banner at top of card.

NEW ORDER NOTIFICATION: top alert banner "You have 2 new orders!" in amber.

Style: Action-oriented. Clear status workflow. Urgent items visually flagged.
```

---

### PROMPT: Seller Reports / Analytics Page

```
Design a seller analytics/reports page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal, chart colors.

PAGE HEADER: "Seller Reports" + date range selector (last 7/30/90 days)

STATS GRID (4 cards):
- Total Revenue XAF (upward trend)
- Items Sold (count)
- Rental Income XAF
- Profile Views (count, eye icon)

CHARTS SECTION:
CHART 1 — Revenue Trend:
- Line chart (teal line, forest green fill area) — monthly revenue last 6 months
- X: months, Y: XAF values

CHART 2 — Listing Performance:
- Horizontal bar chart per listing (top 5)
- Views vs Inquiries vs Sales per item
- Colors: teal (views), forest green (sales), amber (inquiries)

CHART 3 — Sales by Category:
- Donut chart with legend
- Forest green, teal, cream segments

TOP LISTINGS TABLE:
- Rank | Image | Name | Views | Sales | Revenue
- Trophy icon for #1

EXPORT: "Download Report PDF" + "Export CSV" buttons (outlined)

Style: Clean analytics dashboard. Charts as hero. 4-stat summary row at top.
```

---

### PROMPT: Seller Settings Page

```
Design a seller settings/profile page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal.

SECTIONS:

SELLER PROFILE:
- Shop name / display name
- Bio/description textarea
- Avatar upload
- Contact preference (Messages only / Phone / WhatsApp)

PAYMENT SETTINGS:
- MTN MoMo number (primary payout)
- Orange Money number (backup)
- Minimum payout threshold
- Auto-payout toggle

LISTING DEFAULTS:
- Default university/location
- Default meetup preferences

NOTIFICATION PREFERENCES:
- New order: on/off toggle
- New message: on/off toggle
- Review received: on/off toggle
- Payment received: on/off toggle

VACATION MODE:
- Toggle to pause all listings
- Return date picker
- Auto-message to buyers during vacation

Style: Same settings panel layout as buyer settings. Seller-specific sections clearly labeled.
```

---

## PART 6 — ADMIN PAGES

---

### PROMPT: Admin Dashboard (Main)

```
Design an admin dashboard for "UniTrade" platform administrators. Reference: SurgeShield dashboard style — dark forest green sidebar, stat cards, activity feed, trend chart.

COLORS: Sidebar #1B5E44 (forest green), page bg cream #F5F0E8, cards white, teal accents.

SIDEBAR (dark forest green, 240px):
- Platform logo white top
- "ADMIN PANEL" label in teal-light small caps
- Nav sections:
  OVERVIEW: Dashboard
  USERS: User Management, Approvals Queue, User Details
  CONTENT: Listings, Categories, Universities
  COMMERCE: Transactions, Payouts
  MODERATION: Reviews, Disputes, Reports
  COMMUNICATIONS: Admin Inbox, Notifications
  SYSTEM: Settings, Analytics
- Active item: bg #134035, teal-light text, left teal border
- Bottom: Admin avatar + name + "Sign Out"

TOP STATS (4 white cards, row):
- Total Users: count + "+12 this week" in teal
- Active Listings: count + trend
- Revenue (XAF): total + this month
- Pending Approvals: count + "requires action" in amber

CHARTS ROW:
CHART 1 — User Growth (line chart, last 30 days):
- Two lines: New Registrations (teal) vs Active Users (forest green)
- Fill area under teal line
- X: days, Y: count

CHART 2 — Transaction Volume:
- Area chart, forest green fill
- X: days, Y: XAF

ACTIVITY FEED (right column, 30% width):
- "Recent Activity" heading
- Scrollable list of timestamped events:
  - New user registered (blue dot)
  - Listing posted (green dot)
  - Transaction completed (teal dot)
  - Dispute filed (red dot)
  - Listing flagged (amber dot)
- Each item: colored dot, description text, "X mins ago"

PENDING ITEMS (bottom row, 2 cards):
- Pending Approvals: table of users awaiting approval (name, university, date, Approve/Deny buttons)
- Flagged Listings: thumbnail + name + reason + Review button

Style: Professional admin control center. Forest green sidebar like SurgeShield. Stats + charts + activity feed layout.
```

---

### PROMPT: Admin Analytics Page

```
Design a comprehensive analytics dashboard for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white cards, teal charts.

HEADER: Date range selector (last 7/30/90 days / custom) + "Export Report" button

STATS ROW (6 cards, 3-col):
- Total Users / New Users this period
- Total Listings / New Listings
- Gross Transaction Volume (XAF)
- Platform Revenue (XAF)
- AI Chat Sessions
- Disputes Filed

CHARTS SECTION:

CHART 1 — Platform Growth (full width):
- Multi-line chart: Users, Listings, Transactions over time
- Toggle lines on/off via legend
- Teal, forest green, amber lines

CHART 2 — Revenue Breakdown (donut):
- Platform fees, Subscription revenue
- Forest green + teal segments

CHART 3 — Top Universities by Activity:
- Horizontal bar chart, universities ranked by user count/transactions
- Teal bars

CHART 4 — Listing Categories Distribution:
- Donut or pie chart

CHART 5 — AI Assistant Usage:
- Daily usage bar chart, teal bars
- Usage limit line overlay in red

TABLE — Top Sellers:
- Rank | Seller | University | Total Sales (XAF) | Rating | Items Sold

TABLE — Recent High-Value Transactions:
- Date | Buyer | Seller | Item | Amount | Status

Style: Data-heavy but clean. Charts first, tables below. Color-coded consistently across all charts.
```

---

### PROMPT: User Management Page

```
Design a user management page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white table card, teal accents.

PAGE HEADER: "User Management" + "Export Users CSV" button

FILTER BAR:
- Search: name, email, student ID
- Filter by: Role (All / Buyer / Seller / Admin), Status (Active / Suspended / Pending), University dropdown
- Date joined range picker

USER TABLE (white card, rounded-xl):
Columns:
- Checkbox (bulk select)
- Avatar + Name + email (stacked)
- University
- Role badge: Buyer (teal) / Seller (forest green) / Admin (purple)
- Status badge: Active (green) / Suspended (red) / Pending (amber)
- Join Date
- Listings count
- Orders count
- Actions: View (eye icon), Verify (checkmark, teal), Suspend (pause icon, amber), Delete (trash, red)

BULK ACTIONS bar (appears when rows selected):
- "Verify Selected" teal button
- "Suspend Selected" amber button
- "Delete Selected" red button

USER DETAIL DRAWER (slide in from right on click):
- Full user profile
- Account actions
- Activity log
- Notes field for admin

PAGINATION: bottom of table

Style: Data table with inline quick actions. Drawer pattern for details. Bulk operations support.
```

---

### PROMPT: Admin Approvals Page

```
Design a pending user approvals queue page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white cards.

PAGE HEADER: "Approval Queue" + count badge "12 Pending" in amber

FILTER: University dropdown + Date filter + Search by name

APPLICANT CARDS (list view):
Each card (white, rounded-xl):
- Applicant avatar + full name + email
- University name + Student ID
- Applied date + "X days ago" muted
- Documents section: Student ID card preview thumbnail (click to enlarge), any uploaded proof
- Quick Decision row:
  - "Approve" forest green button
  - "Deny" red outlined button
  - "Request More Info" teal ghost button
- Note field (optional, expandable)

BATCH ACTIONS: "Approve All Selected" + "Deny All Selected" buttons at top

APPROVED HISTORY tab: shows past approvals with who approved them + timestamp.

EMPTY STATE: Checkmark illustration, "Queue is clear! All applicants have been reviewed."

Style: Decision-focused. Documents prominent. Quick action buttons per card.
```

---

### PROMPT: Admin Inbox (All Conversations)

```
Design the admin messaging/inbox view for "UniTrade" — shows all buyer-seller conversations for moderation.

COLORS: Forest green sidebar, cream bg, white panels.

LAYOUT: Same 2-col messaging layout as buyer messages.

LEFT — Conversation List:
- "All Conversations" heading + search + filter (All / Reported / Flagged)
- Each row: Buyer avatar + Seller avatar side-by-side, "Buyer Name ↔ Seller Name", item name, last message preview, timestamp
- Reported conversations: red left border
- Flagged: amber left border

RIGHT — Chat View (read-only for admin):
- Header: "Buyer Name ↔ Seller Name re: [Item]"
- "ADMIN VIEW — Read Only" banner in amber at top
- Full message history visible (both sides)
- Admin action bar below:
  - "Flag Conversation" amber button
  - "Warn Buyer" / "Warn Seller" ghost buttons
  - "Remove Message" red icon on hover per message
  - "Block User" dropdown option

Style: Same messaging UI as buyer/seller but with admin read-only mode and moderation actions clearly indicated.
```

---

### PROMPT: Admin Listings Page

```
Design a listings moderation page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white card table.

PAGE HEADER: "Manage Listings" + filter tabs: All | Active | Flagged | Removed

FILTER BAR:
- Search by title or seller
- Category filter
- University filter
- Date posted range

LISTINGS TABLE:
Columns:
- Checkbox
- Image + Title (stacked)
- Category
- Seller name (link to profile)
- Price / Rental rate
- Status: Active / Flagged / Removed
- Views count
- Date posted
- Actions: View (eye), Flag (flag icon, amber), Remove (trash, red), Restore (if removed)

FLAGGED LISTINGS: amber top border on row + "Review Required" label.

BULK ACTIONS: Remove Selected, Restore Selected.

LISTING DETAIL MODAL:
- Full listing preview (images, title, description, price)
- Seller info
- Reported by: list of users who flagged it
- Admin action: Approve (keep) / Remove / Request Edit

Style: Moderation-focused table. Flagged items visually distinct. Detail modal for full review.
```

---

### PROMPT: Admin Transactions Page

```
Design a transaction monitoring page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white table card.

PAGE HEADER: "All Transactions" + summary: "Total Volume: 45,200,000 XAF this month"

FILTER BAR:
- Date range, Status filter, Payment method filter, Min/Max amount

TRANSACTION TABLE:
Columns:
- Reference (#TXN-2026-...)
- Date
- Buyer → Seller (avatar + name)
- Item: thumbnail + name
- Payment method icon (MTN/Orange)
- Amount XAF
- Platform fee XAF
- Status: Completed / Pending / Disputed / Refunded
- Actions: View details, Issue refund, Flag

TRANSACTION STATS (top cards, small):
- Total transactions this period
- Total volume XAF
- Platform fees earned XAF
- Disputed transactions count

REFUND MODAL:
- Transaction details
- Refund amount input (pre-filled)
- Reason select
- "Issue Refund" red button with confirmation

Style: Financial data table. Color-coded statuses. Summary stats at top.
```

---

### PROMPT: Admin Categories Page

```
Design a category management page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white cards.

PAGE HEADER: "Item Categories" + "Add Category" forest green button

CATEGORIES GRID (3-col white cards):
Each card:
- Category icon (colored circle bg matching category color)
- Category name bold
- Description text small
- Listing count: "142 active listings" in teal
- Actions row: Edit (pencil, teal) | Hide/Show (eye toggle) | Delete (trash, red)

ADD/EDIT CATEGORY MODAL:
- Category name input
- Description textarea
- Icon picker (emoji or icon library grid)
- Color picker (for category color)
- Active toggle
- "Save Category" forest green button

DRAG to reorder categories (drag handle icon on each card).

EMPTY STATE: Plus icon, "No categories yet. Add your first one!"

Style: Visual card grid for categories. Icon picker in modal. Drag-to-reorder.
```

---

### PROMPT: Admin Universities Page

```
Design a universities management page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white cards.

PAGE HEADER: "Universities" + "Add University" forest green button

UNIVERSITY LIST (table or list cards):
Each row:
- University logo/initials circle
- Full name + short name/acronym
- City/Location
- Registered students count
- Active listings count
- Status: Active / Inactive toggle
- Actions: Edit | Delete

MAP SECTION (optional):
- Cameroon map with pins for each university location
- Teal pins for active, gray for inactive

ADD UNIVERSITY MODAL:
- Name + Short Name inputs
- City + Region selectors
- Email domain (for verification)
- Upload logo
- "Add University" green button

Style: Clean list/table. Map visual adds spatial context.
```

---

### PROMPT: Admin Payouts Page

```
Design a payout management page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white cards.

PAGE HEADER: "Seller Payouts" + total pending: "XAF 2,400,000 Pending"

TABS: Pending | Processing | Completed | All

PAYOUT TABLE:
Columns:
- Seller (avatar + name)
- University
- Payment method (MTN/Orange icon + phone)
- Amount (XAF) — bold forest green
- Orders included (count link)
- Requested date
- Status: Pending (amber) / Processing (teal) / Paid (green)
- Actions: "Process Payout" (green, if pending) | "Mark Paid" | "View Details"

STATS (top):
- Total paid out this month: XAF
- Pending payouts: XAF count
- Average payout: XAF
- Sellers with pending: count

BATCH PAYOUT:
- Checkboxes + "Process Selected" button
- Confirmation modal with total amount and count

Style: Financial table. Pending payouts are the primary action. Color-coded status.
```

---

### PROMPT: Admin Settings Page

```
Design a platform settings page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white cards.

SETTINGS SECTIONS (left tab nav + right panel):

GENERAL:
- Platform name, tagline
- Logo upload
- Contact email, support email
- Default language (EN/FR toggle)
- Currency: XAF (read-only info)

FEES:
- Platform transaction fee % (input with %)
- Minimum transaction amount
- Maximum listing price
- Rental deposit %

AI ASSISTANT:
- AI Provider select (OpenAI / Gemini / HuggingFace)
- Daily limit per user (number input)
- System prompt textarea
- Enable/Disable AI toggle

EMAIL:
- SMTP configuration fields
- Test email button
- Email templates list

SECURITY:
- Password min length
- 2FA required toggle
- Session timeout duration
- Max login attempts

MAINTENANCE:
- Maintenance mode toggle (with warning: "This will lock out all users")
- Maintenance message textarea

Style: Tabbed settings. Warning for destructive toggles (maintenance mode, fee changes). Clean input forms per section.
```

---

### PROMPT: Admin Reviews Moderation Page

```
Design a reviews moderation page for "UniTrade" admins.

COLORS: Forest green sidebar, cream bg, white cards.

PAGE HEADER: "Reviews Moderation" + tabs: All | Flagged | Removed

REVIEW LIST:
Each review card (white, rounded-xl):
- Reviewer: avatar + name + "Verified Buyer" badge
- Seller being reviewed: avatar + name
- Item purchased: thumbnail + name
- Star rating: gold stars (large)
- Review text: full body
- Date posted
- Flag reason (if flagged): amber warning box
- Actions:
  - "Approve" (keep) green button
  - "Remove Review" red button
  - "Warn Reviewer" amber ghost button

FLAGGED reviews: amber left border + "Reported X times" badge.

REVIEW STATS (top):
- Total reviews: count
- Average platform rating: stars + number
- Flagged this week: count

Style: Content moderation focused. Flagged reviews visually prominent. Quick approve/remove actions.
```

---

## PART 7 — AI ASSISTANT PAGE

---

### PROMPT: AI Assistant Page (Sasha)

```
Design a full-page AI assistant chat interface for "UniTrade." The AI is named "Sasha." Reference: ChatGPT / Claude interface with marketplace context.

COLORS: Sidebar forest green, chat bg cream, user bubbles teal, AI bubbles white.

LAYOUT: Left sidebar 260px + right chat area.

LEFT SIDEBAR:
- "Sasha AI" header with sparkle icon (teal)
- "New Chat" button: forest green, plus icon, full-width
- Chat history list:
  - Grouped: Today, Yesterday, Last Week
  - Each item: conversation title (auto-named), timestamp
  - Active: forest green bg tinted, left teal border
  - Hover: trash icon appears right to delete
- Bottom: daily usage indicator "12 / 50 messages used" — progress bar teal

RIGHT — CHAT AREA:
HEADER:
- "Sasha" title + subtitle "Your campus marketplace AI"
- Model/provider badge small: "Powered by Gemini" teal pill

WELCOME STATE (new chat):
- Sasha avatar centered (circular, teal bg, sparkle icon white)
- "Hi, I'm Sasha!" heading
- "I can help you find items, answer questions about selling, or explain how UniTrade works."
- Suggested prompt cards (2x2 grid):
  - "Find me a laptop under 150,000 XAF"
  - "How do I list an item for rent?"
  - "What's the safest way to pay?"
  - "Show me electronics near UBa"

MESSAGE AREA (scrollable):
- User messages: right side, teal bubble, white text, rounded-tl-xl rounded-l-xl
- AI messages: left side, white card with teal left accent border, dark text, rounded-tr-xl rounded-r-xl
- AI avatar (small teal circle with sparkle) left of AI messages
- PRODUCT RECOMMENDATIONS within AI messages: horizontal scroll of mini product cards (image + name + price + teal "View" button)
- Suggested follow-ups: teal chip buttons below AI message
- Typing indicator: three animated dots in teal

INPUT AREA (white bar, fixed bottom):
- Left icons: image upload (photo icon), voice input (mic icon)
- Text input: "Ask Sasha anything..." placeholder, full-width, cream bg, rounded-full
- Send button: teal circle, arrow icon
- "Sasha may make mistakes. Verify important info." disclaimer tiny text below

Style: ChatGPT-inspired but with UniTrade branding. Teal user messages, white AI messages on cream bg. Product cards embedded in AI responses.
```

---

## PART 8 — ADDITIONAL PAGES

---

### PROMPT: Subscription Page

```
Design a subscription/premium plans page for "UniTrade."

COLORS: Cream bg, white cards, forest green, teal, gold for premium.

HEADER SECTION:
- "Upgrade Your UniTrade Experience" heading
- Subtext: "Get more visibility, faster payouts, and priority support"

PRICING CARDS (3 cards centered):

FREE PLAN (gray border):
- "Free" large heading
- "0 XAF / month"
- Feature list with checkmarks:
  - ✓ List up to 5 items
  - ✓ Basic messaging
  - ✓ Standard visibility
  - ✗ AI assistant (limited)
  - ✗ Priority support
- "Current Plan" gray button

SELLER PRO (forest green border, "Most Popular" badge):
- "Pro Seller" heading
- "2,500 XAF / month"
- Feature list:
  - ✓ Unlimited listings
  - ✓ Featured placement
  - ✓ AI assistant (full access)
  - ✓ Priority support
  - ✓ Analytics dashboard
  - ✓ Instant payouts
- "Upgrade to Pro" forest green button

UNIVERSITY PLAN (teal border, for student groups):
- "Campus Bundle" heading
- "Contact for pricing"
- Feature list: all Pro features + bulk accounts for student associations
- "Contact Us" teal outlined button

TOGGLE: Monthly / Annual pricing (annual shows "Save 20%" badge)

FAQ below: accordion of subscription questions.

Style: Classic pricing page. Middle card elevated/highlighted as recommended.
```

---

### PROMPT: Payment Review Page

```
Design a payment review/confirmation page shown before completing a purchase in "UniTrade."

COLORS: Cream bg, white card, forest green, teal.

CENTERED CARD (max-width 560px):
- Back arrow link
- "Review Your Order" heading bold forest green
- Divider

ORDER SUMMARY:
- Product image (80px) + name + condition + category
- Seller name + avatar + rating
- Price: XAF amount bold large

PAYMENT METHOD SELECTED:
- MTN MoMo icon + "****1234" masked number
- "Change" teal link

COST BREAKDOWN TABLE:
- Item price: X XAF
- Platform fee (5%): X XAF
- ────────
- Total: XX,XXX XAF (bold, large, forest green)

MEETUP DETAILS:
- Location: UBa Main Campus, Sciences Block
- Time: Jun 16, 2026 at 2:00 PM
- "Change Details" teal link

TERMS:
- Checkbox: "I confirm the item matches the description and I agree to the Terms of Service"

"Confirm & Pay" button: large, forest green, full-width, shield + lock icon left

Style: Final confirmation before payment. Summary-focused. Trust signals (shield icon, terms).
```

---

### PROMPT: Rental Details Page

```
Design a rental item detail page for "UniTrade" buyers.

COLORS: Cream bg, white cards, forest green, teal.

Same base layout as Order Details but adapted for rentals.

RENTAL TIMELINE:
- Rental start date → End date visual calendar range
- Days remaining countdown badge (teal pill if active, amber if < 3 days, red if overdue)

RENTAL TERMS CARD:
- Daily rate, weekly rate, monthly rate
- Deposit amount (if applicable)
- Late return policy text
- Damage policy text

CONDITION DOCUMENTATION:
- Images uploaded at rental start (before)
- Return condition: "Pending" or "Documented" badge

EXTENSION REQUEST:
- "Request Extension" button
- Opens modal: new end date picker, calculated additional cost, reason text, "Send Request" button

Style: Calendar-centric. Clear rental period visualization. Extension flow prominent.
```

---

## PART 9 — DESIGN TOKENS QUICK REFERENCE

```css
/* Copy these to your Stitch design token setup */

--color-primary: #1B5E44;
--color-primary-dark: #134035;
--color-primary-light: #2D7A5F;
--color-teal: #0D9488;
--color-teal-light: #5EEAD4;
--color-cream: #F5F0E8;
--color-cream-dark: #EDE8DC;
--color-surface: #FFFFFF;
--color-text-primary: #1A1A1A;
--color-text-secondary: #4A5568;
--color-text-muted: #9CA3AF;
--color-success: #16A34A;
--color-warning: #D97706;
--color-danger: #DC2626;
--color-critical: #7C3AED;
--color-border: #E2D9CC;

--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;

--shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
--shadow-elevated: 0 4px 16px rgba(27,94,68,0.10);
--shadow-modal: 0 20px 60px rgba(0,0,0,0.15);

--font-family: 'Inter', system-ui, sans-serif;
--sidebar-width: 240px;
--header-height: 64px;
--max-content-width: 1280px;
```

---

## PART 10 — IMAGE PROMPT REFERENCES (for AI image generation)

Use these prompts in Midjourney, DALL-E, or Ideogram to generate realistic images for the UI:

**Hero Image (Home Page):**
> "African university students in Cameroon exchanging and inspecting second-hand goods outdoors on campus, warm golden hour lighting, candid lifestyle photography, clean background, modern clothing, diverse group, photorealistic, high resolution"

**Product Category Icons:**
> "Flat icon set for student marketplace categories: books, laptop, furniture, kitchen appliances, clothing, sports equipment, stationery — clean vector style, teal and forest green colors, white background"

**Empty State Illustrations:**
> "Minimal flat illustration of empty shopping cart with African student character, teal and forest green palette, friendly and warm, simple geometric style"

**AI Assistant Avatar (Sasha):**
> "Friendly AI assistant avatar icon, sparkle/star motif, circular badge style, teal and white colors, modern minimal design, suitable for chat interface"

**How It Works Illustrations (3 steps):**
> "Simple 3-step illustration for student marketplace: step 1 browsing on phone, step 2 chatting with seller, step 3 handing over money — flat vector, teal green palette, African student characters"

---

*End of Design Prompts — UniTrade / Stitch Design System*
*Total pages covered: 50+ screens across Public, Buyer, Seller, Admin, and AI sections*
