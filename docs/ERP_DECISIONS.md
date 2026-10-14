# ERP Decisions

## D-001: Do not build schema-dependent modules on the GitHub baseline (open)

- **Context:** The owner's local copy has unpushed contract and migration work
  (MRP Phase 1, procurement, inventory). GitHub has only migration
  `20261008T1419`.
- **Decision:** Pause phases 2–8 until the local work is pushed or explicitly
  abandoned. Building a parallel contract would produce two migration graphs
  that cannot be merged mechanically, and a second inventory implementation.
- **Status:** Awaiting owner.

## D-002: Schema-mismatch errors are surfaced, not suppressed

PostgreSQL `42P01`/`42703` (missing table or column, i.e. an unapplied migration)
map to HTTP 503 `DATABASE_SCHEMA_OUTDATED` with an actionable message. The
table and column are logged server-side, not returned to the client.
(`server/core/errors/database-errors.ts`, commit `e1241ae`.)

## D-003: Login rate limiting

- Per-email limit: 5 failures per 15-minute window. Per-IP limit: 20 failures
  per window. The store is capped at 10,000 entries, evicting oldest first.
- A successful login clears only the account counter, not the IP counter.
- The window now runs from the first failure. Previously the 5-minute lockout
  ran from the last attempt.
- Per-instance memory remains a known limitation until a shared store exists
  (Phase 8, needs a table).

## D-004: Scrap/yield convention for BOM (implemented, Phase 4)

Component scrap is a percentage on the component line:
`gross = net × (1 + scrap%)`. It is applied exactly once, at explosion of that
line. A parent yield, if modelled, divides the parent requirement before
explosion, and is never combined with component scrap on the same quantity.

## D-005: Stage quantity rule (superseded by D-021)

Per stage run: `input = accepted + rejected + wastage` (all ≥ 0, decimal).
Stage remaining = total stage input − Σ(run inputs). This is derived, never
client-supplied, and never negative. The next stage's available input is the
accepted output of the previous stage. QC rejection routes to rework or hold;
it never advances to packing.

## D-006: Unavailable features are disabled with a stated reason

When a backend does not exist, pages show a notice and disable mutating actions,
with a tooltip giving the reason. They never keep records client-side or show a
success message. (Inventory: commit `e1241ae`. Other modules: Phase 1.)

## D-007: Removed `app/test-route`

A development page that rendered "Route is working", with no links to it. It
was flagged by the audit and is recoverable from git history.

## D-008: One availability map for areas without a backend

`config/moduleAvailability.js` lists the route prefixes with no API or tables.
`components/layout/ModuleAvailabilityBanner.jsx` (rendered by `AppShell`)
shows a warning on those routes, so ~100 pages are covered without per-page
edits. The banner is hidden in print. Remove an entry when its backend lands.
Inventory keeps its own per-page notice (commit `e1241ae`).

## D-009: Client stores refuse mutations

`lib/useQualityStore.js`, `useFulfillmentStore.js`, `useOrderStore.js` and
`usePeoplePayrollStore.js` keep their read shape (empty lists, derived
helpers), but every mutation is `unavailableAction(...)` from
`lib/backendUnavailable.js` and throws `BackendUnavailableError`. Entry-point
buttons are disabled with the reason as their tooltip. Page forms are kept for
reuse when APIs exist. `lib/useInventoryStore.js` was unused and deleted.

## D-010: Login remembered-email without setState in an effect

`app/login/page.jsx` reads the remembered email with `useSyncExternalStore`
(server snapshot `""`), and the user's own edits take precedence. Storage access
is wrapped in try/catch so blocked storage cannot turn a successful login into
an error. Verified in Chromium: no hydration warnings, restore after reload,
typing overrides, and unchecking works.

## D-011: Exact decimal money arithmetic

`server/core/utils/decimal.ts` converts each number through its shortest
decimal string to a scaled BigInt, so `quantity × unit price`, discounts and
tax are exact and round half up to the cent. This replaced floating-point
maths that produced wrong cents. For example, 3 × 1.005 gave 3.01 instead of
3.02, and 1 × 1.005 gave 1.00 instead of 1.01. The order editor preview uses
the same module, so the preview matches the saved totals.

Lines or orders beyond `Number.MAX_SAFE_INTEGER` cents are rejected by
validation (400) instead of overflowing. Existing orders keep their stored
totals; an order is recalculated only when it is next saved.

## D-012: Unit price precision (please confirm)

Previously the editor allowed only whole cents, while the API stored prices
rounded to 2 decimals but computed line totals from the unrounded price. The
stored order could therefore disagree with itself.

The decision now in place: unit prices are stored exactly as entered, up to
6 decimal places (validated server-side). The editor accepts sub-cent prices,
which are common for per-piece fastener components. **Owner to confirm**
whether sub-cent prices should be allowed. If not, the rule changes to a
2-decimal limit enforced in both the editor and the server, never silent
rounding.

The same rule applies to product unit prices (`server/products`). These were
also silently stored rounded to 2 decimals. Unit prices display with 2–6
decimals everywhere (`lib/formatters/formatters.js`): product detail,
editor product picker, order profile and printed sheet.

## D-013: Printable documents

Documents live under `/print/...`, outside the ERP shell, behind the same
session check, and load data through the normal permission-checked API. A4
print CSS repeats table headers, keeps rows whole and numbers pages. The
document title follows the record status, so a draft never prints as a
confirmation. `config/company.js` holds only the trading name. The legal
name, address and tax registration are deliberately empty until the owner
provides them.

## D-014: Test resolver for TypeScript imports

`tests/support/ts-resolve.mjs` (loaded by `npm test`) retries relative
imports with `.ts`, so tests can import server modules that use
extensionless imports, as Next.js does. Test-only; application resolution
is unchanged.

## D-015: Data exports

Exports are generated server-side (`GET /api/sales/orders/export`) with the
same permission and filter validation as the list, and every export writes
a `SALES_ORDERS_EXPORTED` audit event with its filters and row count. Above
10,000 rows the export is refused (422) with a request to narrow the
filters; it never silently truncates. CSV follows RFC 4180, starts with a
UTF-8 BOM for Excel, and neutralises spreadsheet formulas in text fields
(`server/core/utils/csv.ts`). CSV was chosen over a native .xlsx library to
avoid a new dependency; Excel opens it directly.

## D-016: Product is the single item master

Inventory items are `Product` rows extended with size, material, type,
finish, colour, logo, barcode and minimum stock. There is no second item
table, and sales order lines already reference products. Every distinct
combination is its own SKU. `lib/inventory/sku.js` suggests a deterministic
SKU from the specification; the unique constraint guarantees no collisions.
The required catalogue (`lib/inventory/catalog.js`, from `config/items.js`)
expands to 72 distinct items. The previous generator collapsed "Antique
Silver/Brass/Copper" into one SKU and dropped slider variants; it now yields
72 unique SKUs (tested).

## D-017: Stock ledger design

- Balances (`erp_stock_balances`) per product + location with buckets on
  hand / reserved / quality hold. CHECK constraints: all buckets >= 0, and
  reserved + hold <= on hand.
- All changes go through stock documents posted in one transaction. Each
  bucket change is an atomic conditional `UPDATE ... RETURNING` that refuses
  to take available stock below zero, and writes an append-only movement
  with the resulting balance. The audit event is written in the same
  transaction. Balance updates are applied in a fixed (product, location)
  order to avoid deadlocks.
- Idempotency: unique `idempotencyKey` per document. The UI creates one key
  per opened form, so retries return the original document.
- Document numbers come from `erp_document_sequences` via atomic upsert
  (`GRN-2026-000001`).
- Unit precision: Pcs, Sets, Boxes and Gross are whole numbers; Meters and
  Kgs allow 3 decimals.
- Finished goods and WIP views are balances in warehouses typed
  `FINISHED_GOODS` / `WIP`. Stage-level WIP arrives with production.

## D-018: Prisma 8 ORM filtered update is not atomic

Verified with PostgreSQL statement logging: `where(filter).update(...)` runs
`SELECT id ... WHERE filter LIMIT 1` and then `UPDATE ... WHERE id = <id>`.
It updates at most one row and does not re-check the filter, so it cannot
serve as compare-and-set. Concurrency-sensitive transitions (stock buckets,
reservations, sales status) use raw conditional `UPDATE ... RETURNING` via
`db.raw.sql\`...\`.returnsRow(...).build()` (`.build()` is required). Multi-row
deletes use `deleteAll()`.

## D-019: BOM and MRP permissions (please confirm)

No new permissions were seeded. Mapping: `production:view` to see BOMs and
MRP runs; `production:create` to create or edit draft BOMs, create
revisions, and run MRP; `production:update` to approve, activate or obsolete
BOMs and to confirm or cancel planned orders. Admin roles have all of these.
Production managers can therefore approve their own BOMs. If approval must
be separated from authoring, a dedicated `bom:approve` permission can be
added to the seed.

## D-020: MRP scope and assumptions

Each run stores its assumptions with its results:
- Demand is approved-order catalogue lines within an optional horizon.
- Delivered quantities are not subtracted, because there is no dispatch
  module yet.
- Supply is unreserved, non-held stock plus stock reserved for the
  demanded orders. There are no scheduled receipts yet (no procurement).
- Planned MAKE/BUY orders are suggestions. Confirming one records the
  decision only (compare-and-set, audited). Converting confirmed orders
  into production or purchase orders comes with those modules.
- Runs are serialised by an advisory lock.

## D-021: Production quantity rule and workflow (implements D-005)

Rework is added to the D-005 rule. Per stage run, in the order's unit:
`input = accepted + rejected + wastage + rework`, all >= 0 and input > 0.
Database CHECK constraints enforce this as well as the service.

- **Received.** Stage 1 receives the order quantity. Every later stage
  receives the accepted output of the previous stage.
- **Waiting.** `received + rework - processed`. Rework units go back into
  the same stage's queue. This value is derived on the server and never
  supplied by the client. A run cannot exceed it.
- **Partial runs.** A stage can start as soon as its predecessor has
  accepted output; it does not wait for the predecessor to complete.
- **Completing a stage.** Only when the previous stage is complete and
  nothing is waiting. Completion then moves the order's current stage on.
- **Completing the order.** Completing the ninth stage (Delivered) completes
  the order.
- **Order status.**
  - PLANNED → RELEASED (release).
  - RELEASED → IN_PROGRESS when the first run is recorded.
  - RELEASED or IN_PROGRESS → ON_HOLD, and resume returns to the held status.
  - PLANNED or RELEASED → CANCELLED. An order with recorded work cannot be
    cancelled; put it on hold instead.
  - Runs and stage completion are refused unless the order is RELEASED or
    IN_PROGRESS.
- **Concurrency.** Every write locks the order row (`FOR UPDATE`). Concurrent
  runs on one order are therefore serialised and can never over-consume
  the waiting quantity (tested with 5 parallel runs).
- **Idempotency.** Each run carries an idempotency key, unique in the
  database. A replay returns the order without recording the run again.
- **History.** Runs and `ProductionEvent` rows are append-only. Every change
  also writes an audit row in the same transaction.
- **Planned orders.** A production order can be created from a CONFIRMED
  MAKE planned order for the same item. A unique `plannedOrderId` makes
  that conversion happen at most once (409 on the second attempt).
- **Sales orders.** A linked sales order must be APPROVED.
- **Material.** The order records the item's active BOM revision when it is
  created. The material requirement is
  `quantity × per-unit × (1 + scrap%)`, computed exactly.
- **Material issues.**
  - Material issues and returns are stock documents with
    `sourceType = "ProductionOrder"`.
  - The inventory service accepts them only for RELEASED or IN_PROGRESS
    orders. It takes `FOR SHARE` on the order, so a status change cannot
    interleave.
  - No other document type can carry that source.
- **Permissions.**
  - `production:view` to see orders.
  - `production:create` to create orders.
  - `production:update` for release, hold, resume, cancel and recording
    runs.
  - `production:complete` for completing stages.
  - Please confirm this mapping together with D-019.

Not implemented:
- Capacity or machine scheduling. The schedule page lists open orders by due
  date.
- Automatic finished-goods receipt on completion. Post an FG receipt in
  inventory; this is linked in Phase 6 with QC and packing.
- Production orders are not yet MRP supply: open orders do not reduce MRP
  net requirements. This is recorded as a known gap for the next MRP change.
