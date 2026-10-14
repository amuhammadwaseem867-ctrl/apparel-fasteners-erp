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
| Administration | users, roles, settings, audit | Static, banner | No user/role/audit API. Seeded RBAC exists in `server/auth/seed.ts`. |
| Dashboard | dashboard | Working | Connected in commit `e1241ae`. Sales/customer/product KPIs only; other modules reported as not connected. |
| Customers | sales/customers | Working | |
| Products | products, [id], new, edit | Working | Unit price stored exactly up to 6 decimals; it was previously rounded to 2 silently (D-012). |
| Products: BOM, categories, variants, pricing, documents | 5 pages | Static | No tables. |
| Sales orders | list, new, [id], edit, print | Working | Statuses are DRAFT / APPROVED / CANCELLED only; the New→Delivered lifecycle needs a schema change. Exact decimal totals (D-011). Printable A4 order sheet (D-013). CSV export of filtered list (D-015). |
| Planning / MRP | 8 pages | Static, honest | No BOM or MRP tables. No-op Refresh buttons disabled with reason; shell banner. |
| Procurement | 7 pages | Static, banner | No supplier/PR/RFQ/PO/GRN tables or API. The "productId linking failure" from the audit is not reproducible here: there is no procurement code. |
| Inventory | 13 pages | Static, honest | Banner states the backend is missing; stock-changing actions disabled (commit `e1241ae`). |
| Production | 11 pages | Static, honest | Store mutations throw `BackendUnavailableError`; fake 350 ms refreshes removed; Refresh/Create disabled with reason; shell banner (Phase 1). |
| Quality | 8 pages | Static, honest | Store mutations throw; create/release/refresh entry points disabled with reason; shell banner (Phase 1). |
| Packing | 5 pages | Static, honest | Store mutations throw; New Packing Order disabled; shell banner (Phase 1). |
| Dispatch | 5 pages | Static, honest | Store mutations throw (row actions only appear with records, which cannot exist); shell banner (Phase 1). |
| Finance | 11 pages | Static, honest | Workspace no longer stores records in page state; save/confirm/report report "not saved"; add/transaction/generate disabled; shell banner (Phase 1). |
| People & Payroll | 11 pages | Static, honest | All 34 store mutations (incl. floating-point `computePayrollEntry`) throw; create/import/period buttons disabled; shell banner (Phase 1). |
| Reports | 17 pages | Static, banner | No reporting API beyond the dashboard. |
| Gate passes | none | Missing | No pages, no tables. |
| Printing / export | sales order sheet | Partial | `/print/sales-orders/[id]`, plus shell print CSS. Other documents depend on their modules' data. Sales order list CSV export (Excel-compatible). PDF comes from the browser's print dialog. |

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

Banner = `ModuleAvailabilityBanner` in `AppShell`, driven by `config/moduleAvailability.js`.

## Other verified facts

- **No page keeps business records in browser state any more** (Phase 1). Guarded by `tests/server/module-availability.test.mjs`.
- Fixed: garbled characters (`â€”`, `â€¦`, `Ã—`, `Â·`) in `components/sales/OrderEditor.jsx`.
- Missing asset: `app/login/page.jsx` references `/logo in navy.png`, which was never committed (404 on the login page). It exists only in the owner's local copy.
- Unused components: `components/products/ProductDocuments.jsx`, `ProductVariants.jsx` and `ProductImageUpload.jsx` are imported nowhere.

- All 94 sidebar destinations have a page (no dead links).
- `npm test` runs only DB-free tests. `tests/server/auth-rbac.test.mjs` writes to the database and is excluded.
- ESLint: 0 errors, 22 warnings (the `app/login` error was fixed in Phase 1).
