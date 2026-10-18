# Marketplace Fix Report

## Summary

Implemented the buyer dashboard/sidebar, catalog category/search pages, product details API/UI, authenticated wishlist integration, buyer/vendor order detail flows, authenticated order tracking, contact page, role-aware navigation, and visible 404 handling. No database schema changes or migrations were made.

The implementation does not add unsupported email delivery or real-time carrier tracking. Checkout now creates an order only: the repository has no mobile-money provider, and the UI no longer claims that a payment was verified or completed.

## Issues and root causes

| Issue | Confirmed root cause | Status |
|---|---|---|
| Product detail | The frontend requested `GET /products/{id}`, but the catalog router had no product-by-ID GET route. The dashboard could also generate non-backend `prod-*` IDs when API data lacked an ID. | Partially Fixed; live product API/navigation not verified |
| Categories | Category choices existed only as local filtering on the marketplace; there was no `/categories` route or category-list API. | Partially Fixed; browser interaction not verified |
| Search | Marketplace search was local to loaded products, did not submit to the catalog query parameter, and did not preserve query in URL. | Partially Fixed; live search/refresh not verified |
| Order date/payment | Buyer order output omitted stored `created_at`; order creation wrote `PAID` without a payment gateway, and checkout displayed a false payment-confirmation message. | Partially Fixed; payment processing remains unsupported |
| Buyer order details | No single-order endpoint existed; the buyer UI filtered the fetched list locally. | Partially Fixed; ownership query covered by tests, live DB/browser not verified |
| Vendor order details | Vendor detail route rendered the buyer order component. | Partially Fixed; vendor-scoped endpoint tested, live DB/browser not verified |
| Tracking | No `/track-order` route existed. Shipment data supports vendor-supplied carrier/tracking/estimate only, with no carrier events. | Partially Fixed; live lookup not verified; tracking remains non-live |
| Wishlist | Frontend stored wishlist in browser-local Zustand persistence instead of using the existing authenticated, buyer-scoped wishlist API. | Partially Fixed; API synchronization not tested against configured backend |
| Dashboard and login navigation | `/dashboard` redirected to the vendor workspace; buyer had no dashboard sidebar, and login did not restore `state.from`. | Partially Fixed; authentication/role behavior not browser-tested |
| Contact | Footer had working contact links, but no `/contact` page or message-submission service existed. | Partially Fixed; page has links only, no form |
| Unknown routes | Router redirected unknown paths silently to the home page. | Partially Fixed; not-found UI added; browser route testing unavailable |

## Files changed

### Backend

- `apps/api/app/modules/catalog/router.py`
  - Added approved-product lookup by UUID, returning 404 when absent or not approved.
- `apps/api/app/modules/orders/router.py`
  - Added buyer order date and actual optional shipment values to buyer order responses.
  - Added buyer order detail query scoped to the authenticated buyer.
  - Added vendor order detail query scoped to the authenticated vendor.
  - Removed the vendor response's fabricated fallback delivery address.
  - Stopped writing a made-up estimated delivery placeholder at order creation.
  - Changed new order payment status from `PAID` to `PENDING` because no payment confirmation service exists.
- `apps/api/tests/test_catalog_product_ordering.py`
  - Added coverage for missing/unapproved product detail lookup.
- `apps/api/tests/test_order_detail_authorization.py`
  - Added buyer/vendor ownership and unauthorized-not-found coverage for order detail endpoints.

### Frontend

- `apps/web/src/app/router.tsx`
  - Added public catalog/search/contact routes, protected buyer workspace, protected order tracking, separate vendor order detail route, and the not-found route.
  - Changed `/buyer/profile` to a compatibility redirect to buyer `/dashboard`; kept `/vendor/dashboard`.
- `apps/web/src/app/buyer/BuyerLayout.tsx`, `DashboardPage.tsx`, `WishlistPage.tsx`, `OrderTrackingPage.tsx`, `orders/page.tsx`
  - Added responsive buyer navigation, dashboard summaries, API-backed wishlist view, authenticated tracking lookup, and buyer order list/detail states.
- `apps/web/src/app/vendor/OrderDetailsPage.tsx`
  - Added a vendor-only order detail view.
- `apps/web/src/pages/CatalogBrowsePage.tsx`, `ContactPage.tsx`, `NotFoundPage.tsx`
  - Added product-derived categories, server-backed shareable search, verified contact links, and visible 404 UI.
- `apps/web/src/pages/ProductDetails.tsx`
  - Added real product fields/actions with loading, invalid-ID, unavailable, and API failure states.
- `apps/web/src/types/products.ts`
  - Added the product detail image crop field returned by the existing catalog response.
- `apps/web/src/pages/dashboard.tsx`
  - Removed generated product IDs, connected wishlist mutations to the API-backed store, changed the header search to submit to `/search`, linked dashboard orders, and surfaced catalog/wishlist errors.
- `apps/web/src/api/orders.ts`, `apps/web/src/api/wishlist.ts`, `apps/web/src/store/wishlist.ts`, `apps/web/src/hooks/useWishlistSync.ts`
  - Added typed detail/wishlist API clients and buyer-account synchronization for wishlist state.
- `apps/web/src/features/auth/login.tsx`
  - Restored only safe role-compatible protected destinations after login.
- `apps/web/src/components/vendor/VendorOrders.tsx`
  - Linked vendor order details, removed invented address/ETA presentation, and exposed list/mutation errors.
- `apps/web/src/components/marketplace/MarketplaceFooter.tsx`
  - Added valid categories, search, tracking, contact, and order-history links.
- `apps/web/src/pages/CheckoutPage.tsx`
  - Removed simulated payment verification/confirmation and phone data that was not sent to a payment provider; displays created order references and explains payment is not processed.

## API and data contract changes

- `GET /api/v1/products/{product_id}` returns an approved product or 404. A malformed UUID is handled by FastAPI validation.
- `GET /api/v1/orders/buyer` returns stored creation time and nullable shipment values instead of placeholder strings.
- `GET /api/v1/orders/buyer/{order_id}` requires an authenticated buyer and constrains the query by both order ID and buyer ID.
- `GET /api/v1/orders/vendor/{order_id}` requires vendor authorization and constrains the query by order ID and vendor ID.
- The existing wishlist endpoints are reused; no new wishlist backend routes were added.
- No schema or migration changes were made.
- The buyer order API still does not return payment status; checkout clearly reports that payment was not processed. Order-specific shipping address remains unsupported because checkout does not persist it.

## Verification results

| Check | Result |
|---|---|
| `npm run build` in `apps/web` | Passed (`tsc -b`, Vite production build). Vite emitted a bundle-size advisory for a chunk larger than 500 kB. |
| Focused ESLint for new/changed frontend pages, auth, store, clients, vendor orders, and footer | Passed. |
| `npm run lint` in `apps/web` | Failed with 61 ESLint errors across the workspace. Findings include legacy `any` usage and React hook rule violations. Do not treat this as a clean full lint run. |
| `pytest` in `apps/api` | Passed: 23 tests. Two dependency/schema deprecation warnings were emitted. |
| `git diff --check` | Passed. |
| Direct-route shell smoke test | Passed: local Vite returned HTTP 200 `text/html` for `/dashboard`, `/categories`, `/search?q=phone`, `/contact`, `/track-order`, `/vendor/orders/123`, and `/admin`. This verifies SPA fallback delivery only, not client-side rendering. |
| Browser/API end-to-end | Not run successfully. The shared browser CDP connection timed out; `http://127.0.0.1:5174/dashboard` was unreachable. No configured authenticated database session was available for live ownership checks. |

No frontend test runner is declared in `apps/web/package.json`; frontend interaction behavior is therefore not represented by automated UI tests in this change.

## Routes

Route definitions are in `apps/web/src/app/router.tsx`. New pages are `/dashboard`, `/categories`, `/search`, `/contact`, `/track-order`, `/buyer/orders/:orderId`, and `/vendor/orders/:orderId`. `/buyer/profile` redirects to `/dashboard`. Existing vendor/admin routes and legacy aliases are retained. Unknown routes render a 404 page. `apps/web/vercel.json` already rewrites requests to the Vite app shell; direct refresh behavior was not manually verified.

## Known limitations and required follow-up

- Configure a real payment provider and implement server-side verification/webhooks before representing payment as paid or collecting mobile-money credentials.
- Configure a contact-submission endpoint and mail delivery before adding a contact form or success response.
- Add a carrier integration if live shipment events/status are required; current tracking is an authenticated display of stored vendor-supplied values.
- Define and implement address persistence before showing an order-specific delivery address.
- Decide whether guest wishlist entries should be retained; this implementation does not persist or merge guest wishlist state.
- The dashboard profile panel is read-only. Existing account APIs are not wired to profile-editing controls.
- Run the manual retest checklist in [ISSUES.md](./ISSUES.md) with a configured database, buyer/vendor accounts, and a running browser app.
