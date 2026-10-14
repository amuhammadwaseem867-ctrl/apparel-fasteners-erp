# ERP Module Status

Verified against source on 2026-10-14, branch `claude/inspiring-davinci-7l1qm2`
(base `20f4286`, identical to `origin/main`). The checks are static source
inspection plus the DB-free test suite; no database was reachable from this
environment (`DATABASE_URL` not set), so no live schema check was possible.

## Baseline caveat

The 2026-10-13 audit was taken from the owner's working copy at
`D:\apparel-fasteners-erp`, which contains work that has **not been pushed**
to GitHub. The audit describes an MRP Phase 1 migration, procurement services,
inventory APIs and a product-linking failure; **none of these exist in the
committed repository.** Statuses below describe the committed code only.

## Backend that exists

| Area | API routes | Service | Tables (contract) |
|---|---|---|---|
| Auth / sessions / RBAC / audit | `/api/auth/{login,logout,session,change-password}` | `server/auth/*` | `erp_users`, `erp_roles`, `erp_permissions`, `erp_role_permissions`, `erp_user_roles`, `erp_user_sessions`, `erp_audit_logs` |
| Customers | `/api/customers` | (inline route) | `erp_customers` |
| Products | `/api/products`, `/api/products/[id]` | `server/products/*` | `erp_products` |
| Sales orders | `/api/sales/orders`, `/api/sales/orders/[id]` | `server/sales/*` | `erp_sales_orders`, `erp_sales_order_lines` (has `productId`) |
| Dashboard | `/api/dashboard` | `server/dashboard/*` | reads the above |

There is exactly one migration: `migrations/app/20261008T1419_migration`.

## Module status

Legend: **Working** = UI → API → service → DB path exists. **Static** = renders,
no backend, no records. **Fake persistence** = keeps records in browser memory
and reports success; data is lost on reload and never reaches the server.

| Module | Pages | Status | Notes |
|---|---|---|---|
| Authentication | login, profile | Working | Login rate limiting hardened in this session (per-IP + bounded store). Still per-instance memory. |
| Administration | users, roles, settings, audit | Static | No user/role/audit API. Seeded RBAC exists in `server/auth/seed.ts`. |
| Dashboard | dashboard | Working | Connected in commit `e1241ae`. Sales/customer/product KPIs only; other modules reported as not connected. |
| Customers | sales/customers | Working | |
| Products | products, [id], new, edit | Working | |
| Products: BOM, categories, variants, pricing, documents | 5 pages | Static | No tables. |
| Sales orders | list, new, [id], edit | Working | Statuses are DRAFT / APPROVED / CANCELLED only. Required New→Delivered lifecycle needs a schema change. |
| Planning / MRP | 8 pages | Static | No BOM or MRP tables. |
| Procurement | 7 pages | Static | No supplier/PR/RFQ/PO/GRN tables or API. The "productId linking failure" from the audit is not reproducible here: there is no procurement code. |
| Inventory | 13 pages | Static, honest | Banner states the backend is missing; stock-changing actions disabled (commit `e1241ae`). |
| Production | 11 pages | **Fake persistence** | `lib/useOrderStore.js` (orders, stage-board). |
| Quality | 8 pages | **Fake persistence** | `lib/useQualityStore.js` + success toasts (inspections, final, ncr, capa). |
| Packing | 5 pages | **Fake persistence** | `lib/useFulfillmentStore.js` (packing/orders). |
| Dispatch | 5 pages | **Fake persistence** | `lib/useFulfillmentStore.js` (shipments, ready, dispatch, delivered). |
| Finance | 11 pages | **Fake persistence** | `components/finance/FinanceWorkspace.jsx` success toasts. |
| People & Payroll | 11 pages | **Fake persistence** | `lib/usePeoplePayrollStore.js`, mounted app-wide in `app/(erp)/layout.jsx`. Salary data held in browser memory. |
| Reports | 17 pages | Static | No reporting API beyond the dashboard. |
| Gate passes | none | Missing | No pages, no tables. |
| Printing / export | none | Missing | No print layouts or print CSS. |

## Audit findings re-verified

| Audit finding (2026-10-13) | Committed repo |
|---|---|
| Unapplied MRP Phase 1 migration | Migration does not exist here (local-only work). |
| Missing productId / reservation columns, MRP tables | `productId` is in the contract and migration `20261008T1419`. Reservation and MRP tables do not exist in the contract. If the live DB lacks `productId`, that migration is unapplied. Not verifiable without DB access. |
| Procurement product-linking runtime failure | No procurement code here. |
| Inventory pages disconnected from existing APIs | No inventory APIs exist to connect. Pages now say so (commit `e1241ae`). |
| Dashboard does not consume its API | **Fixed** (commit `e1241ae`). |
| No BOM authoring / MRP calculation | Confirmed missing. |
| Production, QC, Dispatch, Finance, Payroll, Reports, Gate Pass, Admin incomplete | Confirmed. Several use fake persistence (see table). |
| Missing login rate limiting | Partly wrong: per-email lockout existed. It lacked a per-IP limit and had an unbounded store. **Fixed** in this session. |
| Leftover test route | Confirmed (`app/test-route`). **Removed** in this session. |

## Other verified facts

- All 94 sidebar destinations have a page (no dead links).
- `npm test` runs only DB-free tests. `tests/server/auth-rbac.test.mjs` writes to the database and is excluded.
- ESLint baseline: 1 error (`app/login/page.jsx`, setState in effect) and 22 warnings.
