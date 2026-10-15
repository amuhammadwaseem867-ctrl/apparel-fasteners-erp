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
| Products / item master | `/api/products`, `/api/products/[id]` (PATCH restore, DELETE ?permanent) | `server/products/*` | `erp_products` (+ specification fields, minimumStock, barcode) |
| Planning (BOM, MRP) | `/api/planning/{boms,mrp-runs,planned-orders}` | `server/planning/*` | `erp_boms`, `erp_bom_lines`, `erp_mrp_runs`, `erp_mrp_demands`, `erp_mrp_requirements`, `erp_mrp_planned_orders` |
| Inventory | `/api/inventory/{warehouses,locations,balances,summary,movements,documents,reservations}` | `server/inventory/*` | `erp_warehouses`, `erp_storage_locations`, `erp_stock_balances`, `erp_stock_documents`, `erp_stock_movements`, `erp_stock_reservations`, `erp_document_sequences` |
| Production | `/api/production/{orders,orders/[id],orders/[id]/stages/[stageKey]/{runs,complete},summary}` | `server/production/*` | `erp_production_orders`, `erp_production_stages`, `erp_production_stage_runs`, `erp_production_events` |
| Quality | `/api/quality/{inspections,inspections/[id],summary}` | `server/quality/*` | `erp_quality_inspections` |
| Packing | `/api/packing/{lists,lists/[id]}` | `server/packing/*` | `erp_packing_lists`, `erp_packing_packages` |
| Dispatch | `/api/dispatch/{shipments,shipments/[id],sales-orders/[id]}` | `server/dispatch/*` | `erp_shipments`, `erp_shipment_lines` |
| Finance (invoicing) | `/api/finance/{invoices,invoices/[id],uninvoiced-shipments,credit-notes,credit-notes/[id],receipts,receipts/[id],receivables,summary}` | `server/finance/*` | `erp_invoices`, `erp_invoice_lines`, `erp_credit_notes`, `erp_credit_note_lines`, `erp_customer_receipts` |
| Administration | `/api/admin/{users,users/[id],users/[id]/password,roles,roles/[id],permissions,audit,audit/actions}` | `server/admin/*` | existing RBAC and audit tables |
| Sales orders | `/api/sales/orders`, `/api/sales/orders/[id]` | `server/sales/*` | `erp_sales_orders`, `erp_sales_order_lines` (has `productId`) |
| Dashboard | `/api/dashboard` | `server/dashboard/*` | reads the above |

Migrations: `20261008T1419_migration` (base) → `20261014T1134_inventory_foundation` → `20261014T1624_bom_mrp` → `20261014T1640_production_stages` → `20261015T1506_quality_packing_dispatch` → `20261015T1605_invoicing_receivables` (all additive; applied and verified only on the isolated test database).

## Module status

Legend: **Working** = UI → API → service → DB path exists. **Static** = renders,
no backend, no records. **Fake persistence** = keeps records in browser memory
and reports success; data is lost on reload and never reaches the server.

| Module | Pages | Status | Notes |
|---|---|---|---|
| Authentication | login, profile | Working | Login rate limiting hardened in this session (per-IP + bounded store). Still per-instance memory. |
| Administration | users, roles, settings, audit | **Working** (3) / reference (1) | Users (create, edit roles, enable/disable, password reset), roles (custom roles with permissions; system roles read-only), and audit log (filters) are connected, with lockout protection (D-024). Settings is a read-only reference page (banner). Verified in Chromium against the test DB. |
| Dashboard | dashboard | Working | Connected in commit `e1241ae`. Sales/customer/product KPIs only; other modules reported as not connected. |
| Customers | sales/customers | Working | |
| Products | products, [id], new, edit | Working | Unit price stored exactly up to 6 decimals; it was previously rounded to 2 silently (D-012). Item specification fields, deterministic SKU suggestion, restore, guarded permanent delete. |
| Products: BOM | bom | **Working** | Revisions, draft editing, approve, activate (one active per item), obsolete, revise; cycle refusal. |
| Products: categories, variants, pricing, documents | 4 pages | Static | No tables. |
| Sales orders | list, new, [id], edit, print | Working | Statuses are DRAFT / APPROVED / CANCELLED only; the New→Delivered lifecycle needs a schema change. Exact decimal totals (D-011). Printable A4 order sheet (D-013). CSV export of filtered list (D-015). |
| Planning / MRP | 8 pages | **Working** (5) / static (3) | Overview, MRP runs (run, history, detail, confirm/cancel planned orders, convert confirmed MAKE orders to production orders), material requirements, shortages, and material reservations (shared with inventory) are connected. Capacity, calendar and production plans are not implemented (banner). |
| Procurement | 7 pages | Static, banner | No supplier/PR/RFQ/PO/GRN tables or API. The "productId linking failure" from the audit is not reproducible here: there is no procurement code. |
| Inventory | 13 pages | **Working** (12) / static (1) | Overview, stock, item master + profile, warehouses/locations, movements, transfers, adjustments, counts, reservations, finished goods and WIP (by warehouse type) are connected; printable slips. Batches & Lots remains unavailable (no batch schema). Verified in Chromium against the test DB. |
| Production | 11 pages | **Working** | Overview (live KPIs and per-stage totals), orders (list, new, detail), stage board, schedule (open orders by due date), operations, stage output, completion, material issue are connected. On the order: release/hold/resume/cancel, record stage runs (accepted/rejected/wastage/rework), complete stages in sequence, issue BOM material through the stock ledger, append-only history, printable job card. Created from confirmed MRP MAKE orders. Work orders and shop floor redirect to orders and the stage board (D-021). Verified in Chromium against the test DB. |
| Quality | 9 pages | **Working** (7) / static (2) | The overview shows live totals; the fabricated KPIs were removed. Inspections (all, incoming, in-process, final, rejections & rework) and the inspection detail with approve/cancel are connected. Final inspections record the Quality Check stage; incoming inspections release or scrap held stock (D-022). NCR and CAPA are not implemented (banner). |
| Packing | 5 pages | **Working** (4) / static (1) | Overview, packing lists (create with packages and quick fill, confirm, cancel), list detail, packed & shipped, printable packing list. Confirming records the packing stage and receives finished goods. Packages redirects to packing lists. Packing instructions are not implemented (banner). |
| Dispatch | 6 pages | **Working** | Overview, ready for delivery (packed lists by sales order), dispatch (drafts), shipments, delivered, shipment detail (dispatch, confirm delivery, cancel draft) and a printable delivery challan. Partial deliveries are supported; nothing ships past the ordered quantity. Verified in Chromium against the test DB. |
| Finance | 12 pages | **Working** (5) / static (7) | Overview (live receivable, overdue, invoiced/received last 30 days), invoices (from dispatched shipments, issue/cancel draft), invoice detail (receipts, void, credit notes), receipts, receivables ageing; printable invoice, credit note and receipt (D-023). Accounts, income, expenses, payables, cash & bank, transactions and financial reports are not implemented (banner). Verified in Chromium against the test DB. |
| People & Payroll | 11 pages | Static, honest | All 34 store mutations (incl. floating-point `computePayrollEntry`) throw; create/import/period buttons disabled; shell banner (Phase 1). |
| Reports | 17 pages | Static, banner | No reporting API beyond the dashboard. |
| Gate passes | none | Missing | No pages, no tables. |
| Printing / export | sales order sheet, stock slips, job card, packing list, delivery challan, invoice, credit note, receipt | Partial | `/print/sales-orders/[id]`, `/print/stock-documents/[id]`, `/print/production-orders/[id]`, `/print/packing-lists/[id]`, `/print/shipments/[id]`, `/print/invoices/[id]`, `/print/credit-notes/[id]`, `/print/receipts/[id]`, plus shell print CSS. Other documents depend on their modules' data. Sales order list CSV export (Excel-compatible). PDF comes from the browser's print dialog. |

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

## Superseded files kept on purpose

The Inventory rewrite left these unreferenced. They are not deleted, so that
pushing the owner's local copy cannot hit modify/delete conflicts. Delete
them once the branches are reconciled:
`app/(erp)/inventory/**/*.css` (11 old page stylesheets, plus
`item-master/[sku]/ItemProfile.css`) and
`components/inventory/Inventory{Activity,KpiGrid,LowStock,MovementSummary,QuickActions,StockSummary,WarehouseStatus,Workflow}.{jsx,css}`.

The Production rewrite left these unreferenced:
`app/(erp)/production/**/*.css` (old page stylesheets) and
`components/production/Production{Activity,Issues,KpiGrid,Operations,Output,QuickActions,Schedule,WorkOrders,Workflow}.{jsx,css}`.

The Quality, Packing and Dispatch rewrite left these unreferenced:
- `components/quality/InspectionList.jsx`;
- `components/quality/Quality{Activity,CAPA,Defects,InspectionSummary,Inspections,KpiGrid,NCR,QuickActions,Rejections,Workflow}.{jsx,css}`
  (the NCR/CAPA pages may still use some of them);
- the old page stylesheets under `app/(erp)/packing` and `app/(erp)/dispatch`.

Procurement pages show `0` / `0%` placeholder KPIs under their banner. They
should become "—" in the UI polish phase.

The Finance rewrite left the old page stylesheets
(`app/(erp)/finance/**/*.css`) unreferenced. The other finance pages still
use `components/finance/FinanceWorkspace.jsx` and `financeConfigs`.
