# Cravora

![Cravora cover](docs/screenshots/cover.png)

A food-delivery web app built from the Cravora Figma design (`ziahdesign` → page "Cravora — Food Delivery App"). With it you can:

- browse restaurants and dishes, and customise items with required and optional choices;
- keep a cart that lives on the server, apply a promo code, and check out;
- follow an order's status, rate it, reorder it, and keep favorites, addresses and notifications;
- if you own a restaurant, accept orders and move them forward.

**Stack:** Next.js 16 (App Router, Server Components + Server Actions) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Supabase (Postgres, Auth, Row Level Security) · Zod · Vitest + PGlite · Playwright · Lucide icons.

> **What's real and what isn't:**
> - **Payments:** no payment provider is connected. Customers choose *cash on delivery* or a clearly labelled *demo card* that never charges anything, and no card data is collected.
> - **Tracking:** there's no live GPS or courier. Tracking shows real order statuses set by the restaurant, and the map is a labelled illustration.
> - **Notifications:** they appear inside the app only; no email or push.

---

## Screens

These are the design frames from the Figma export, scaled to 1×. Each one is implemented at the route shown under it.

### Welcome & discovery

| Welcome | Sign in | Home | Home — saved |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/00-welcome.png" width="180" alt="Welcome"> | <img src="docs/screenshots/00b-sign-in.png" width="180" alt="Sign in"> | <img src="docs/screenshots/01-home.png" width="180" alt="Home"> | <img src="docs/screenshots/01b-home-restaurant-saved.png" width="180" alt="Home, restaurant saved"> |
| `/welcome` | `/login` | `/` | `/` |

| Search | Results — restaurants | Results — dishes | No results |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/02-search.png" width="180" alt="Search"> | <img src="docs/screenshots/02b-search-results.png" width="180" alt="Restaurant results"> | <img src="docs/screenshots/02d-search-results-dishes.png" width="180" alt="Dish results"> | <img src="docs/screenshots/02c-no-results.png" width="180" alt="No results"> |
| `/search` | `/search?q=burger` | `/search?q=burger&view=dishes` | `/search?q=…` |

### Restaurant & menu

| Restaurant | Restaurant — saved | Added to cart | Dish details | Required option |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/03-restaurant-details.png" width="150" alt="Restaurant"> | <img src="docs/screenshots/03b-restaurant-saved.png" width="150" alt="Restaurant saved"> | <img src="docs/screenshots/03c-restaurant-added-to-cart.png" width="150" alt="Added to cart"> | <img src="docs/screenshots/04-dish-details.png" width="150" alt="Dish details"> | <img src="docs/screenshots/04b-dish-required-option.png" width="150" alt="Required option"> |
| `/restaurants/[slug]` | `/restaurants/[slug]` | `/restaurants/[slug]` | `/dishes/[id]` | `/dishes/[id]` |

### Cart & checkout

| Cart | Remove item? | Empty cart | Item removed (Undo) |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/05-cart.png" width="180" alt="Cart"> | <img src="docs/screenshots/05b-remove-item-confirm.png" width="180" alt="Remove item confirmation"> | <img src="docs/screenshots/05c-cart-empty.png" width="180" alt="Empty cart"> | <img src="docs/screenshots/05d-cart-item-removed.png" width="180" alt="Item removed"> |
| `/cart` | `/cart` | `/cart` | `/cart` |

| Checkout | Select address | Updated total | Payment method |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/06-checkout.png" width="180" alt="Checkout"> | <img src="docs/screenshots/06b-select-address.png" width="180" alt="Select address"> | <img src="docs/screenshots/06c-checkout-updated-total.png" width="180" alt="Updated total"> | <img src="docs/screenshots/07-payment-method.png" width="180" alt="Payment method"> |
| `/checkout` | `/checkout` (sheet) | `/checkout` | `/checkout` |

### Orders & tracking

| Order placed | Placed — updated | Tracking | Order details | Delivered |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/08-order-confirmed.png" width="150" alt="Order placed"> | <img src="docs/screenshots/08b-order-confirmed-updated.png" width="150" alt="Order placed, updated total"> | <img src="docs/screenshots/09-order-tracking.png" width="150" alt="Order tracking"> | <img src="docs/screenshots/09b-order-details.png" width="150" alt="Order details"> | <img src="docs/screenshots/09c-order-delivered.png" width="150" alt="Order delivered"> |
| `/orders/[id]/confirmed` | `/orders/[id]/confirmed` | `/orders/[id]` | `/orders/[id]` | `/orders/[id]` |

| Order history | Reorder | Cancelled order |
| :---: | :---: | :---: |
| <img src="docs/screenshots/10-order-history.png" width="180" alt="Order history"> | <img src="docs/screenshots/10b-past-order-reorder.png" width="180" alt="Reorder"> | <img src="docs/screenshots/10c-order-details-cancelled.png" width="180" alt="Cancelled order"> |
| `/orders` | `/orders?tab=past` | `/orders/[id]` |

### Account

| Favorites | Favorite dishes | Profile | Saved addresses | Add address |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/11-favorites.png" width="150" alt="Favorites"> | <img src="docs/screenshots/11b-favorites-dishes.png" width="150" alt="Favorite dishes"> | <img src="docs/screenshots/12-profile-and-settings.png" width="150" alt="Profile"> | <img src="docs/screenshots/12b-saved-addresses.png" width="150" alt="Saved addresses"> | <img src="docs/screenshots/12c-add-address.png" width="150" alt="Add address"> |
| `/favorites` | `/favorites?tab=dishes` | `/profile` | `/addresses` | `/addresses/new` |

| Payment methods | Help center | Notifications |
| :---: | :---: | :---: |
| <img src="docs/screenshots/12d-payment-methods.png" width="180" alt="Payment methods"> | <img src="docs/screenshots/12e-help-center.png" width="180" alt="Help center"> | <img src="docs/screenshots/13-notifications.png" width="180" alt="Notifications"> |
| `/payment-methods` | `/help` | `/notifications` |

There is no Figma frame for the restaurant owner's order queue (`/restaurant/orders`), sign-up or password reset. Those screens reuse the same tokens and components.

### How the build differs from the design

- **Sign-in uses email and password.** The design's phone and one-time-code login needs an SMS provider. The phone number is still collected at sign-up.
- **Payment methods are honest about what exists.** "Card •• 4821" and the wallet are illustrative in the design. Cravora offers cash on delivery and a labelled demo card; cards and wallets are shown as "Soon".
- **Tracking has no courier name, chat or distance**, because no delivery provider exists. The map is a labelled illustration, and progress comes from real status changes.
- **"Popular near you" becomes "Popular on Cravora", and distance ("1.8 mi") is omitted.** No location is requested or stored. Ratings and review counts are real averages from the reviews table.
- **"Recent searches" and live support chat are not implemented.**

---

## Quick start (local)

Requirements: Node 20+ and Docker.

```bash
npm install
npm run db:start            # local Supabase on ports 563xx, applies migrations + dev seed
cp .env.example .env.local  # then paste API_URL + PUBLISHABLE_KEY from `npx supabase status`
npm run dev -- -p 3002      # http://localhost:3002
```

| Dev account (local seed only) | Password | Role |
| --- | --- | --- |
| `demo@cravora.test` | `cravora-demo` | Customer with order history, addresses and favorites |
| `owner@cravora.test` | `cravora-owner` | Restaurant owner of Stack & Smoke Burgers |
| `owner2@cravora.test` | `cravora-owner` | Restaurant owner of Kintsugi Ramen |

- **Email:** sign-up confirmation and password-reset emails are caught by Mailpit at <http://127.0.0.1:56324>.
- **Seed data:** restaurants, menus and prices are development content; the photos are exported from the Figma file.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Development server / production build / serve the build |
| `npm run lint` · `npm run typecheck` | ESLint (with React Compiler rules) · `tsc --noEmit` |
| `npm test` | Vitest: domain unit tests and database integration tests (PGlite with the real migrations) |
| `npm run test:e2e` | Playwright journeys (needs the app and local Supabase running) |
| `npm run db:start` · `db:reset` · `db:types` | Start the stack · rebuild the database from migrations + seed · generate types |

---

## Architecture

### System overview

```mermaid
flowchart LR
  B["Browser<br/>(mobile-first)"] -->|HTTPS| PX["proxy.ts<br/>session refresh + private-route guard"]
  PX --> RSC["Server Components<br/>(pages)"]
  B -->|"buttons / forms"| SA["Server Actions<br/>Zod validation"]
  RSC --> SV["lib/services<br/>typed reads"]
  SV --> DB
  SA -->|"rpc / table writes"| DB
  subgraph SB["Supabase"]
    AUTH["Auth<br/>(email + password)"]
    DB[("Postgres<br/>RLS on every table<br/>pricing + order functions")]
  end
  PX <-->|"getClaims"| AUTH
  SA <-->|"sign-up / sign-in / reset"| AUTH
```

- **Every request runs as the visitor.** Anonymous visitors can read only the active public catalog. Signed-in customers also see their own rows. Restaurant owners see their own restaurant's orders.
- **The database owns money and order state.** `quote_cart()`, `place_order()` and `update_order_status()` are the only code paths that price carts, create orders or change their status, so the cart screen, checkout and stored order can't disagree.
- **No service-role key** exists anywhere in the app.

### Layers

| Layer | Folder | Responsibility |
| --- | --- | --- |
| Routing & guard | `src/proxy.ts`, `src/lib/supabase/proxy.ts` | Refresh the session, send signed-out visitors from private pages to `/login?next=…` |
| Pages | `src/app/(tabs)`, `src/app/(flow)` | Server Components that load data and render. `(tabs)` has the bottom bar; `(flow)` is full-screen |
| Client islands | `src/components/*` | Dish options, cart steppers, checkout, sheets, dialogs, toasts, favorites |
| Server Actions | `src/app/actions/*` | Validate with Zod, call database functions, map errors to safe messages, revalidate pages |
| Domain | `src/lib/domain` | Money in integer cents, option rules, the order state machine mirror, labels (+ tests) |
| Database | `supabase/migrations` | Schema, constraints, RLS, roles, pricing and ordering functions, notification trigger |

### Folder structure

```
src/
  proxy.ts
  app/
    layout.tsx, globals.css           Roboto + Cravora tokens, toasts
    welcome  login  signup  forgot-password  setup
    auth/confirm  auth/update-password  auth/signout
    (tabs)/  page.tsx (home)  favorites  orders  cart  profile
    (flow)/  search  restaurants/[slug]  dishes/[id]  checkout
             orders/[id]  orders/[id]/confirmed  addresses(/new,/[id])
             payment-methods  notifications  help  restaurant/orders
    actions/ auth.ts  shop.ts
  components/  ui  overlays  toast  nav  cards  shop-controls  dish-form  cart-view
               checkout-form  price-breakdown  order-actions  owner-actions  …
  lib/ domain/ (money, menu, orders)  validations/  services/data.ts  supabase/
  types/database.ts
supabase/
  migrations/ 0100 schema + RLS · 0200 ordering functions
  seed.sql    development data (restaurants, menus, dev accounts, history, reviews)
tests/ db/ (PGlite)  e2e/ (Playwright)
public/images/  photos exported from the Figma file
```

### Ordering flow

```mermaid
sequenceDiagram
  participant U as Customer
  participant UI as Client
  participant A as Server Actions
  participant DB as Postgres functions
  U->>UI: choose options, quantity
  UI->>A: addToCart(item, qty, optionIds)
  A->>DB: cart_add() — validates options (required/min/max/foreign/sold out), one restaurant per cart
  DB-->>UI: added | conflict ("Start a new cart?") | invalid (message)
  UI->>A: (cart) setCartQuantity / setPromoCode
  UI->>DB: quote_cart() — live prices, issues, fees, promo, total
  U->>UI: Place order
  UI->>A: placeOrder(addressId, method, idempotencyKey, schedule?)
  A->>DB: place_order() — one transaction
  Note over DB: lock cart → re-validate items/options/availability → own address →<br/>minimum order → price from DB → promo rules → insert order + item snapshots<br/>+ history + redemption → clear cart. Same key ⇒ same order.
  DB-->>UI: order id → /orders/[id]/confirmed
```

### Order lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending: place_order()
  pending --> confirmed: restaurant accepts
  pending --> cancelled: customer or restaurant
  confirmed --> preparing: restaurant
  confirmed --> cancelled: restaurant
  preparing --> out_for_delivery: restaurant
  out_for_delivery --> delivered: restaurant
  delivered --> [*]
  cancelled --> [*]
```

- **Who can change status.** Customers may only cancel while an order is `pending`. Owners (for their own restaurants) and admins move orders forward. Anything else is rejected by `update_order_status()`.
- **Payment status is separate from order status:**

  | Situation | Payment status |
  | --- | --- |
  | Cash order placed | `due_on_delivery` |
  | Cash order delivered | `paid` |
  | Cash order cancelled | `not_charged` |
  | Demo card order | `demo_authorized`, never `paid` |
  | Demo card order cancelled | `demo_voided` |

- **History and notifications.** Every change writes `order_status_history`. A trigger then creates an in-app notification, if the customer has "Order updates" switched on.
- **Live updates.** Active order pages poll every 20 seconds; there are no websockets.

### Data model

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : has
  AUTH_USERS ||--o{ ADDRESSES : saves
  AUTH_USERS ||--o| CARTS : owns
  AUTH_USERS ||--o{ ORDERS : places
  AUTH_USERS ||--o{ USER_ROLES : "granted by SQL"
  RESTAURANTS ||--o{ FOOD_CATEGORIES : groups
  RESTAURANTS ||--o{ FOOD_ITEMS : sells
  FOOD_ITEMS ||--o{ FOOD_ITEM_OPTIONS : "option groups"
  FOOD_ITEM_OPTIONS ||--o{ FOOD_ITEM_OPTION_VALUES : choices
  CARTS ||--o{ CART_ITEMS : contains
  CART_ITEMS ||--o{ CART_ITEM_OPTIONS : selects
  ORDERS ||--o{ ORDER_ITEMS : "snapshots"
  ORDERS ||--o{ ORDER_STATUS_HISTORY : logs
  ORDERS ||--o| REVIEWS : "rated once"
  ORDERS ||--o| PROMOTION_REDEMPTIONS : uses
  PROMOTIONS ||--o{ PROMOTION_REDEMPTIONS : redeemed
  RESTAURANTS {
    uuid id PK
    uuid owner_user_id
    text slug
    numeric delivery_fee
    numeric min_order
    int eta_max_minutes
  }
  FOOD_ITEMS {
    uuid id PK
    numeric price
    bool is_available
  }
  ORDERS {
    uuid id PK
    text order_number
    text status
    text payment_method
    text payment_status
    numeric subtotal
    numeric total_amount
    uuid idempotency_key
    jsonb delivery_address_snapshot
  }
  ORDER_ITEMS {
    text item_name_snapshot
    numeric unit_price_snapshot
    int quantity
    jsonb selected_options_snapshot
    numeric line_total
  }
```

- **Money** is `numeric(10,2)` in USD. In TypeScript, amounts are converted to integer cents before any arithmetic.
- **Snapshots.** Orders store snapshots of the restaurant name, address, customer contact, item names, option choices and prices, so later menu or profile changes never rewrite history.
- **Totals check.** A check constraint enforces `total_amount = subtotal + delivery_fee + service_fee − discount_amount`.
- **Ratings** come from the `restaurant_ratings` view, which averages real `reviews`. Restaurants with no reviews show "New".

### Pricing (single source: `public.quote_cart` / `public.place_order`)

1. **Unit price** = the item's price + the prices of the selected options.
2. **Line total** = unit price × quantity.
3. **Subtotal** = sum of line totals.
4. **Delivery fee** = the restaurant's fee, or $0 while `free_delivery_until` is in the future.
5. **Service fee** = round(subtotal × 4%, 2 decimals).
6. **Discount** = round(subtotal × promo %, 2 decimals), capped by the promo's maximum. Promos are checked server-side: active window, minimum subtotal, first-order-only and per-user limit.
7. **Total** = subtotal + delivery fee + service fee − discount.

There is no tax: no tax rate was specified, so none was invented. The design's reference order reproduces exactly:

$42.50 + $2.99 + $1.70 − $4.25 = **$42.94**

### Security model

- **RLS is enabled on every table.**
  - The catalog is public (active restaurants only); owners can edit their own catalog.
  - Addresses, favorites, carts, notifications and profiles are owner-only.
  - Orders are readable by the customer and by the restaurant's owner.
- **Writes are restricted by privileges:**
  - Customers can't insert or update orders, order items, history or redemptions.
  - Cart rows are created only by `cart_add()`. Customers can change only a line's `quantity` and the cart's `promo_code`.
  - `user_roles` can't be written by any user; roles are granted by SQL.
- **`SECURITY DEFINER` functions** check `auth.uid()` themselves, use `search_path = ''`, and are executable only by `authenticated`.
- **Verified by tests.** Cross-user and cross-restaurant access is tested at both the database level and the end-to-end level.

---

## Testing (commands and what they cover)

| Suite | Command | Covers |
| --- | --- | --- |
| Unit | `npm test` | Cents and formatting, the design's fee math, option rules (required/max/sold out), pricing preview, the state-machine mirror, ETA, Zod schemas |
| Database integration | `npm test` | Real migrations on PGlite with a Supabase auth stub (details below) |
| E2E | `npm run db:reset && E2E_BASE_URL=http://localhost:3002 npm run test:e2e` | Seven customer and owner journeys (details below) |

The database integration tests cover:

- **Catalog:** public reads, and inactive restaurants hidden from customers.
- **Cart:** option validation, merging identical lines, the restaurant-conflict rule, and the promo quote ($42.94).
- **Writes customers can't make:** changing prices or inserting cart rows directly.
- **`place_order`:**
  - snapshots and totals;
  - snapshot stability after a menu price change;
  - idempotency;
  - promo reuse blocked;
  - someone else's address, unavailable items and below-minimum carts rejected, with no partial order left behind.
- **Access and status:**
  - customers can't edit orders directly;
  - customers and other restaurants can't see someone else's orders;
  - the owner-only state machine, customer cancellation, and payment-status transitions;
  - status notifications.
- **Reviews and roles:** reviews only after delivery and only once; reorder; roles can't be self-assigned.

The E2E journeys cover:

- public browsing, with sign-in required to add to the cart;
- the full order: required options, quantity, cart math, the promo rule, cash checkout, confirmation, history and details;
- another restaurant owner unable to see or change the order;
- the owner advancing the order, with the customer seeing delivered and paid, rating it, and getting a notification;
- reorder, plus cancelling a pending order;
- the deliberate choice required to mix restaurants, and removing an item;
- private-page redirects.

`npx playwright install chromium` is needed once.

## Deployment (Vercel + Supabase)

1. **Create a Supabase project** and apply the migrations. Don't run `seed.sql` in production.
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. **Add production content.** Restaurants, menus and promotions are created with SQL or Supabase Studio; there's no admin UI.
3. **Grant owner roles** with SQL, and set `restaurants.owner_user_id`:
   ```sql
   insert into user_roles (user_id, role) values ('<auth user id>', 'restaurant_owner');
   ```
4. **Configure Supabase Auth:**
   - Site URL: `https://your-domain`.
   - Redirect URLs: `https://your-domain/**`.
   - Keep "Confirm email" on, and configure SMTP for real email delivery.
5. **Set Vercel environment variables:**
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
   - `NEXT_PUBLIC_SITE_URL`.
6. **Deploy, then check:** sign-up confirmation, ordering, and owner status changes.

**Before taking real money:** integrate a payment provider (for example Stripe) with server-side confirmation and verified webhooks. Payment status must only ever be set from the provider's webhook, never from the browser.

## Troubleshooting

- **Everything redirects to `/setup`:** the environment variables are missing. Restart the server after editing `.env.local`.
- **`supabase start` reports a port already allocated:** another local Supabase project is running. Stop it, or change the ports in `supabase/config.toml`.
- **The confirmation link lands on the wrong host:** align `NEXT_PUBLIC_SITE_URL` with Auth → Redirect URLs (locally, `additional_redirect_urls` in `supabase/config.toml`).
- **"Start a new cart?" keeps appearing:** carts hold one restaurant at a time. Finish or clear the current cart first.
- **WELCOME10 is rejected:** it's limited to a customer's first order and needs a subtotal of at least $15.

## Known limitations

- **Payments:** no real payment provider; there are no refunds, and the demo card is never "paid".
- **Delivery:** no live courier tracking, distance-based fees, or delivery zones; ETAs are restaurant estimates.
- **Restaurant owners:** they can process orders, but menu and catalog editing has no UI yet (SQL or Studio only). There's no admin console.
- **Not built:** recent searches, support chat, phone or OTP sign-in, profile photos and account deletion.
