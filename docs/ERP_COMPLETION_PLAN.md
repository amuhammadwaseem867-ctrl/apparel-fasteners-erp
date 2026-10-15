# ERP Completion Plan

Status source: `docs/ERP_MODULE_STATUS.md`. Decisions: `docs/ERP_DECISIONS.md`.

## 0. Blocking prerequisite: one source of truth

The owner's local copy (`D:\apparel-fasteners-erp`) contains unpushed work:
an MRP Phase 1 migration, procurement and inventory services, and contract
changes. GitHub (and therefore every cloud session) has none of it.

Building the schema-dependent phases from the GitHub baseline would create a
second, competing contract and migration graph. Prisma 8 migrations are chained
by contract hash (`migrations/snapshots/<hash>`), so two independent graphs
cannot be merged by hand without re-planning migrations. It would also break the
rule against a second inventory implementation.

**Required before Phase 2 onward:** the owner commits and pushes the local work
(or confirms it should be discarded), and Claude's GitHub access is restored so
work can be pushed. See D-001.

## Dependency graph

```
Auth/RBAC/Audit ──┬─> Admin (users, roles, settings, audit review)
                  │
Item master ──────┼─> Inventory ledger ──┬─> Goods receipt <── Procurement (PR→RFQ→PO)
(products, SKUs,  │   (warehouses,        ├─> Reservations <── Sales order lifecycle
 fastener specs)  │    locations,         ├─> Material issue/return <── Production stages (9)
                  │    movements)         ├─> QC holds <── Quality inspections
                  │                       └─> FG receipt / dispatch <── Packing → Dispatch → Delivery
                  │
                  └─> BOM ──> MRP (demand = sales orders; supply = stock + open POs)

Sales orders + Dispatch ──> Invoicing ──> Finance reports / costing
Employees/Departments ──> Production assignment, Payroll, Gate passes
Everything ──> Reports, Printing/Export, Dashboard KPIs
```

## Phases

Each phase ends with: safe checks green (tsc, lint at or below baseline, DB-free
tests), diff review, and an update to `ERP_MODULE_STATUS.md`.

| Phase | Scope | Needs schema change | Acceptance |
|---|---|---|---|
| 0 | Baseline, docs, safe fixes | No | **Done** (this session): docs; test route removed; login limiter hardened. |
| 1 | Stabilize existing working modules | No | **Done.** Dashboard connected; fake persistence removed from Production, Quality, Packing, Dispatch, Finance and Payroll; shell banner on every area without a backend; no-op refresh buttons disabled; `app/login` lint error fixed (verified in Chromium). |
| 2 | Reconcile contract and migrations | Yes (plan only until authorized) | One migration graph containing the owner's local work. Live DB status verified read-only (`prisma migration status`). Pending migrations reviewed op-by-op. Backup verified. Owner authorizes apply. |
| 3 | Item master + inventory ledger | Yes | Item/variant model covering every fastener spec in the owner's requirements (deterministic SKUs); warehouses/locations; append-only movement ledger with source document/line, idempotency key and per-item row locking; balances derived or maintained transactionally; Inventory pages connected. |
| 4 | BOM + MRP | Yes | BOM revisions with approval, cycle detection, single scrap convention (D-004). MRP runs stored with inputs, BOM revision and results; deterministic decimal maths; planned orders require explicit confirmation. |
| 5 | Production: 9 stages | Yes | **Done.** Stage runs with `input = accepted + rejected + wastage + rework` (D-021); server-enforced sequence; partial runs; hold/resume; rework; append-only history; material issue linked to orders; job card. |
| 6 | QC, packing, dispatch, delivery | Yes | **Done.** QC gates packing (final inspections drive stage 7); packing receives FG (stage 8); dispatch cannot exceed ordered quantity or available FG; partial deliveries; delivery drives stage 9; incoming inspection releases or scraps held stock (D-022). |
| 7 | Finance | Yes | **Done (invoicing and receivables).** Invoices from shipments at sales-order terms (no invented tax); credit notes instead of deletion; receipts with voiding; receivables ageing (D-023). Not a general ledger. Payables wait for procurement. |
| 8 | HR, payroll, admin, gate passes | Yes | **Done.** User/role admin with lockout protection (D-024); shared login limiter (D-025); gate passes (D-026); HR, attendance, advances and exact payroll with separate payroll permissions (D-027). |
| 9 | Print/export, UI polish, E2E | Partly | **Done.** Printable documents for every module; 16 live reports with CSV export; dashboard operations; placeholder clean-up; Chromium regression of all 115 routes for two roles (D-028). XLSX is not produced; CSV opens in Excel. |

## Migration dependencies

- Phase 2 gates phases 3–8. None of them can be built correctly until the
  contract baseline is the owner's real one.
- The sales order lifecycle (New … Delivered) needs a status change on
  `erp_sales_orders`. It is part of Phase 5/6, not a standalone migration.
- No migration is applied to any live database without: verified origin and
  target, full op review, a verified backup, and explicit owner authorization.

## Testing strategy

- DB-free unit tests (`npm test`) for pure rules: quantities, transitions, SKU
  generation, BOM cycles, MRP maths, rate limiting, error mapping.
- DB integration tests only against an isolated database whose identity is
  checked before running (`tests/server/auth-rbac.test.mjs` pattern, gated).
- E2E (Playwright, Chromium available in the cloud container) after Phase 3.

## Unresolved risks

1. Divergent baselines (section 0). Highest risk.
2. Live DB state unknown: there is no DB access from the cloud environment.
3. ~~Login limiter is per-instance memory~~ Resolved by D-025 (shared database counters).
4. `x-forwarded-for` is trusted for the client IP. That is correct behind
   Vercel's proxy but spoofable if the app is exposed directly.
5. Missing `public/logo in navy.png` (local-only asset).

## Work log

| Date | Commit | Change |
|---|---|---|
| 2026-10-14 | `e1241ae` | Dashboard connected; inventory pages made honest; schema-mismatch errors → 503 `DATABASE_SCHEMA_OUTDATED`. |
| 2026-10-14 | `45b265d` | Phase 0 docs; `app/test-route` removed; login limiter per-IP + bounded; tests added. |
| 2026-10-14 | `0a2d6e8` | Phase 1: fake persistence removed; module availability banner; login effect fix; tests added. |
| 2026-10-14 | `5bac865` | Printable A4 sales order sheet; shell print CSS; company config. |
| 2026-10-14 | `0235683` | Exact decimal money maths for sales (fixes wrong cents and overflow); unit price precision; editor text-encoding repair; test TS resolver. |
| 2026-10-14 | `f89fc07` | Sales order CSV export (server-side, audited, formula-safe). |
| 2026-10-14 | `2933ef3` | Product unit prices stored exactly; shared unit-price formatter. |
| 2026-10-14 | `c855e4b` | Isolated-database test runner (`npm run test:db`); auth/RBAC suite ported to Prisma 8 and passing. |
| 2026-10-14 | `51a1cb3` | Inventory schema + migration `20261014T1134_inventory_foundation` (additive). |
| 2026-10-14 | `eda771c` | Inventory services and API; sales status compare-and-set; reservation release on cancel. |
| 2026-10-14 | `e94120e` | Inventory UI connected; item master with catalogue coverage; printable stock slips. |
| 2026-10-14 | `65bb6e3` | Dashboard shows live inventory position. |
| 2026-10-14 | `168ee97` | BOM/MRP schema + migration `20261014T1624_bom_mrp` (additive). |
| 2026-10-14 | `010b97a` | MRP engine, BOM and MRP services, planning API. |
| 2026-10-14 | `b2edcad` | BOM and MRP screens connected. |
| 2026-10-14 | `01dbce8` | Production schema + migration `20261014T1640_production_stages` (additive). |
| 2026-10-14 | `bc056f1` | Production service, API and screens; MRP conversion; material issue linked to orders; job card. |
| 2026-10-15 | `dc35c90` | Quality/packing/dispatch schema + migration `20261015T1506_quality_packing_dispatch` (additive). |
| 2026-10-15 | `2cf3474` | Quality, packing and dispatch services and API; stages 7–9 owned by those modules. |
| 2026-10-15 | `2a77dec` | Quality, packing and dispatch screens; packing list and delivery challan prints. |
| 2026-10-15 | `26c37b6` | Invoicing schema + migration `20261015T1605_invoicing_receivables` (additive). |
| 2026-10-15 | `80b05a5` | Invoicing, credit notes, receipts and receivables services and API. |
| 2026-10-15 | `bb524f5` | Finance screens; invoice, credit note and receipt prints. |
| 2026-10-15 | `2e78acd` | Administration services and API; disabled roles grant nothing; lockout protection. |
| 2026-10-15 | `d8c557b` | Administration screens: users, roles, audit log. |
| 2026-10-15 | `0facbea` | Login limiter shared across instances; migration `20261015T1641_login_attempt_counters` (additive). |
| 2026-10-15 | `b628415` | Gate passes: schema + migration `20261015T1645_gate_passes` (additive), service, API, screens, print. |
| 2026-10-15 | `d1e0a1c` | HR/payroll schema + migration `20261015T1652_hr_payroll` (additive); HR and payroll permissions in the seed. |
| 2026-10-15 | `30264f7` | HR and payroll services and API; migration `20261015T1656_salary_advance_idempotency` (additive). |
| 2026-10-15 | `9bee029` | People & Payroll screens; payslips and payroll register. |
| 2026-10-15 | `d11d2f3` | Phase 9: live reports with CSV export, dashboard operations panel, polish, full-route regression. |
| 2026-10-15 | `f5b261a` | Procurement schema + migration `20261015T1758_procurement` (additive). |
| 2026-10-15 | `e8627d5` | Procurement and payables services, API and DB tests. |
| 2026-10-15 | (this commit) | Phase 10: procurement and payables screens, PO print, E2E (D-029). |

## Status

Phases 0–10 are complete on branch `claude/inspiring-davinci-7l1qm2`.
Everything is verified on the isolated test database: DB-free tests,
DB integration tests, and Chromium end-to-end tests.

**Remaining work, which needs the owner or new scope**
- NCR and CAPA records.
- Shifts and leave balances.
- Packing instructions.
- Product categories, variants, pricing and documents pages.
- Capacity planning and calendar.
- General ledger and financial statements.

**Owner actions before go-live**
1. Push the local `D:\` work and reconcile it with this branch (D-001).
   Then delete the superseded files listed in ERP_MODULE_STATUS.md.
2. Confirm sub-cent prices (D-012).
3. Supply company legal details and tax registration (D-013).
4. Confirm the permission mappings (D-019, D-021–D-023, D-026, D-029) and
   the payroll rules (D-027).
5. Take a verified backup of the live database. Then approve applying the
   ten pending migrations in order:
   - `20261014T1134_inventory_foundation`
   - `20261014T1624_bom_mrp`
   - `20261014T1640_production_stages`
   - `20261015T1506_quality_packing_dispatch`
   - `20261015T1605_invoicing_receivables`
   - `20261015T1641_login_attempt_counters`
   - `20261015T1645_gate_passes`
   - `20261015T1652_hr_payroll`
   - `20261015T1656_salary_advance_idempotency`
   - `20261015T1758_procurement`
6. Run the access-control seed on the live system (new HR and payroll
   permissions and roles).
7. Deploy only after steps 1–6. No production deployment has been made.

Nothing has been applied to any live database.
