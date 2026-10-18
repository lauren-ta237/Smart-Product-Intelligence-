# Marketplace Issue Implementation Status

## Overall status

- **Implementation status:** Changes implemented for the supported requirements; browser/runtime verification is incomplete.
- **Verification status:** Backend tests, frontend build, and focused lint passed. Full frontend lint has pre-existing errors. The local browser app/backend was unavailable for an authenticated end-to-end check.
- **Data integrity:** No live payment gateway, contact submission service, or carrier tracking integration exists. The UI does not claim that these services operated.
- **Database migrations:** None required.

## Issue status

| # | Issue | Status | Implementation and remaining verification |
|---|---|---|---|
| 1 | Product details | Partially Fixed | Added the missing approved-product detail API, stopped generating fallback product IDs, and added distinct loading/not-found/invalid/API error states. Backend route unit coverage and production build passed; live product retrieval and card navigation were not tested against a configured catalog. |
| 2 | Categories | Partially Fixed | Added `/categories`, deriving category names and counts from approved catalog products and filtering those real results. No category endpoint was needed. Browser interaction and live catalog data remain unverified. |
| 3 | Search | Partially Fixed | Added `/search?q=...`, Enter/button submission, server-side catalog `q` queries, shareable query URLs, and empty/loading/error states. The marketplace header now submits to the route. Browser query-refresh behavior and live API search were not verified. |
| 4 | Order date/payment truthfulness | Partially Fixed | Buyer/vendor order responses now include stored order creation time. Order creation marks payment `PENDING` rather than falsely recording a completed payment; checkout no longer collects/sends mobile-money credentials or claims a payment was validated. There is no payment provider, so checkout creates orders only. |
| 5 | Buyer and vendor order details | Partially Fixed | Added buyer- and vendor-scoped order detail endpoints and separate pages. Buyer and vendor ownership constraints have focused tests; list/detail pages handle loading, errors, missing/invalid IDs, and empty lists. Backend tests pass; live authorization over a configured DB and browser behavior remain unverified. |
| 6 | Order tracking | Partially Fixed | Added buyer-authenticated `/track-order` using the buyer-scoped order lookup. Displays only stored shipment values and explains that tracking is not live. No carrier integration or shipment events are available. Runtime behavior not verified. |
| 7 | Wishlist | Partially Fixed | Replaced local persisted wishlist data with the existing authenticated, buyer-scoped API; optimistic add/remove roll back on failure and account changes clear prior in-memory state. Guest wishlist retention/synchronization is not implemented; live API behavior not verified. |
| 8 | Buyer dashboard/sidebar and return path | Partially Fixed | `/dashboard` is now a buyer/customer-protected workspace with responsive sidebar and authenticated order summaries; `/vendor/dashboard` remains separate. `/buyer/profile` redirects. Login restores safe role-matching protected destinations. Browser role/deep-link checks not completed. |
| 9 | Contact page | Partially Fixed | Added `/contact` with verified clickable email and telephone details. No form was added because there is no submission API or configured delivery service. Route/browser behavior not verified. |
| 10 | Route configuration | Partially Fixed | Added categories, search, contact, dashboard, tracking, separate buyer/vendor order detail, and a visible 404 page. Preserved vendor/admin routes and legacy aliases. Vercel's SPA rewrite exists; direct browser refresh and role behavior need manual verification. |

## Confirmed implementation details

- Product cards now retain the actual API product UUID, and products without an ID are excluded from catalog cards rather than assigned a fabricated ID.
- `GET /products/{product_id}` returns only approved products and a 404 for missing or unapproved products.
- Category choices/counts on the new page are derived from approved catalog product data; selecting a category filters the fetched results.
- Search uses the catalog endpoint's existing `q` filter. The query is encoded in `/search?q=...`.
- `GET /orders/buyer/{order_id}` includes `Order.buyer_id == current_user.id` in its database query. `GET /orders/vendor/{order_id}` similarly scopes by the authenticated vendor ID. A missing or unauthorized order is returned as 404.
- Buyer order data includes `created_at` and stored shipment fields; absent carrier/tracking/estimate values are returned as `null`, not success-shaped placeholders.
- Vendor order views no longer show an invented delivery address or automatically write a “3-5 Business Days” estimate. Checkout no longer presents created orders as paid.
- The wishlist remains account-scoped through the backend's existing GET/POST/DELETE API. No guest wishlist merge is attempted.
- The verified footer contacts remain `mailto:nsambulauranta@gmail.com` and `tel:675965385`; `/contact` uses the same values.
- `/buyer/profile` is retained only as a compatibility redirect to `/dashboard`.

## Current frontend routes

| Route | Access | Behavior |
|---|---|---|
| `/` | Public | Marketplace |
| `/products` | Public | Marketplace catalog |
| `/products/:productId` | Public | Approved product details |
| `/categories` | Public | Catalog-derived category browsing |
| `/search` | Public | Search form; results use `?q=...` |
| `/contact` | Public | Verified email and phone links |
| `/dashboard` | Buyer/customer | Buyer workspace and dashboard |
| `/buyer` | Buyer/customer | Buyer marketplace |
| `/buyer/cart` | Buyer/customer | Buyer marketplace with cart drawer |
| `/buyer/wishlist` | Buyer/customer | Account wishlist |
| `/buyer/checkout` | Buyer/customer | Order placement; payment is not processed |
| `/buyer/orders` | Buyer/customer | Buyer order history |
| `/buyer/orders/:orderId` | Buyer/customer | Buyer-scoped order detail |
| `/track-order` | Buyer/customer | Private tracking details for own order only |
| `/buyer/profile` | Any, then buyer/customer protected | Redirects to `/dashboard` |
| `/vendor/dashboard` | Vendor/admin/superadmin | Separate vendor dashboard |
| `/vendor/upload` | Vendor/admin/superadmin | Vendor upload |
| `/vendor/products` | Vendor/admin/superadmin | Vendor catalog |
| `/vendor/products/new` | Vendor/admin/superadmin | Product creation |
| `/vendor/products/:productId/edit` | Vendor/admin/superadmin | Product editing |
| `/vendor/ai/upload` | Alias | Redirects to `/vendor/upload` |
| `/vendor/ai/review` | Vendor/admin/superadmin | Review |
| `/vendor/orders` | Vendor/admin/superadmin | Vendor order list |
| `/vendor/orders/:orderId` | Vendor/admin/superadmin | Vendor-scoped order detail |
| `/vendor/apiKeys` | Vendor/admin/superadmin | Vendor API keys |
| `/vendor/developer/api-keys` | Alias | Redirects to `/vendor/apiKeys` |
| `/admin` | Admin/superadmin | Admin dashboard |
| `/admin/users` | Admin/superadmin | Admin users |
| `/admin/vendors` | Admin/superadmin | Admin vendors |
| `/admin/products` | Admin/superadmin | Admin product moderation |
| `/admin/orders` | Admin/superadmin | Admin order view |
| `/admin/api-keys` | Admin/superadmin | Admin API keys |
| `/admin/analytics` | Admin/superadmin | Admin overview |
| `/login`, `/register` | Public | Authentication |
| `/checkout`, `/upload`, `/review`, `/marketplace`, `/orders`, `/wishlist` | Any, then target guard where applicable | Preserve existing redirects |
| Any unknown route | Public | Visible not-found page |

Protected pages still use `ProtectedRoute`; the buyer layout is nested under buyer/customer roles. A role-mismatched user is redirected by the existing guard. The login return destination is limited to same-origin paths belonging to that user's role.

## Unsupported service requirements

- **Payments:** No mobile-money/payment gateway is configured. Orders are created with `PENDING` payment status. A production payment flow requires a provider, server-side payment verification, webhook handling, and an agreed failure/refund lifecycle.
- **Contact form:** There is no contact submission endpoint or configured outbound email service. The page therefore offers only working email/telephone links.
- **Carrier tracking:** Shipment records hold only vendor-supplied carrier, tracking number, and estimated-delivery text. Live carrier events/status require an integration.
- **Shipping address:** The checkout UI gathers an address, but the current order API does not persist or return it. The order pages intentionally do not display one.
- **Guest wishlist merge:** Guest wishlist state is not persisted or merged into an authenticated buyer's API wishlist.
- **Profile editing:** Account APIs exist, but this dashboard exposes read-only account identity; a complete editing/password form remains outside this implementation.

## Verification performed

- `npm run build` in `apps/web`: **Passed** (`tsc -b` and Vite production build). Vite reports a bundle-size advisory for a minified chunk over 500 kB.
- `npm run lint` in `apps/web`: **Failed**, 61 lint errors remain across the workspace, including legacy `any` usage and React-hook rule violations. No errors were reported by a focused ESLint run over the new buyer pages, order pages, product page, search/categories page, wishlist client/store, contact/404 pages, auth login, vendor orders, and footer.
- `pytest` in `apps/api`: **Passed**, 23 tests. Two warnings: deprecated Pydantic class-based config in catalog search schema and a dependency deprecation from `google.genai`.
- Focused frontend browser tests: **Not run**; no frontend test runner is declared.
- Direct-route shell smoke test: **Passed**; local Vite returned HTTP 200 with `text/html` for `/dashboard`, `/categories`, `/search?q=phone`, `/contact`, `/track-order`, `/vendor/orders/123`, and `/admin`. This confirms SPA fallback delivery only, not client-side rendering.
- Local browser/manual verification: **Not completed**. The shared browser connection timed out and `http://127.0.0.1:5174/dashboard` was not reachable. The configured authenticated DB/API was unavailable for live route/API tests.
- `git diff --check`: **Passed**.

## Manual retest checklist

1. Start the backend with a configured database and start the Vite app from `apps/web`.
2. Sign out, open `/dashboard`, and verify the buyer route asks for login; sign in as a buyer and verify the sidebar/cards render and links work at desktop and mobile widths.
3. Sign in separately as a vendor and verify `/vendor/dashboard` remains available while `/dashboard` does not expose the vendor workspace.
4. Open a real approved product from a marketplace card. Confirm the URL uses its API UUID and the detail endpoint returns the same listing; test an unknown UUID and malformed ID for explicit not-found/invalid states.
5. Open `/categories`, select a listed category, and verify all shown products match the category. Search a known catalog term, verify `/search?q=...`, submit with Enter and the button, refresh, and confirm the same results.
6. As a buyer, add/remove a wishlist item and check the backend wishlist API. Sign out/in as another account and verify items do not cross accounts.
7. Create/fetch buyer orders as two buyers. Confirm each buyer can retrieve only their own order ID; repeat vendor order detail access with the owning and a different vendor.
8. Open `/track-order` while signed out (must require buyer login), then submit an own order ID. Confirm absent shipment values are explicitly unavailable and no live tracking is claimed.
9. Open `/contact` and activate the `mailto:`/`tel:` links. Confirm no form falsely reports message delivery.
10. Refresh every new route directly in the Vercel deployment and open a made-up path to verify the SPA shell and not-found screen.

## Relevant official references

- [React Router `Navigate`](https://reactrouter.com/api/components/Navigate) — route redirects and role-aware post-login navigation.
- [FastAPI dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) — authenticated buyer/vendor endpoint dependencies.
- [FastAPI query parameters](https://fastapi.tiangolo.com/tutorial/query-params/) — catalog filters and the existing search query.
- [SQLAlchemy asyncio](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) — async order/product query implementation.
- [pytest-asyncio concepts](https://pytest-asyncio.readthedocs.io/en/latest/concepts.html) — async endpoint tests.
- [Vite static deployment](https://vite.dev/guide/static-deploy.html) — SPA deployment fallback; it does not replace route handling in React Router.
