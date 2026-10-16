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

## D-022: Quality, packing and dispatch drive stages 7–9

**Ownership of the last three production stages.** Each is driven by the
module that owns it, not by hand. The production order screen links to that
module, and the API refuses manual runs with `STAGE_MANAGED_ELSEWHERE`.
- **Quality Check.** Approving a **final inspection**
  (`inspected = passed + rework + rejected`) records the stage run:
  - passed units go on to packing;
  - rework units return to the Quality Check queue;
  - rejected units are lost.
- **Packing.** Confirming a **packing list** records the stage run
  (accepted = packed quantity). In the same transaction it posts an
  `FG_RECEIPT` of that quantity into the chosen finished-goods location.
  Packing more than passed Quality Check is refused.
- **Delivered.** For a production order linked to a sales order, confirming
  delivery of the shipment that carried its packing list records this stage.
  For make-to-stock orders it is still recorded by hand (handover to stock).

**Incoming inspections.** These cover stock already on quality hold at a
location. On approval:
- passed quantity is released to available stock (`QC_RELEASE`);
- rejected quantity is scrapped (`QC_REJECT`);
- rework quantity stays on hold.

**In-process inspections.** These are sampling records for stages 1–6 and
change no quantities.

**Recording and approving inspections.**
- An inspection is recorded with its results (OPEN), then approved or
  cancelled exactly once (compare-and-set).
- Recording needs `quality:create`; approving needs `quality:approve`.

**Shipments.** A shipment covers one APPROVED sales order. Its lines are
confirmed packing lists, or loose finished-goods stock.
- **Dispatching.** One transaction that:
  - locks the sales order row;
  - re-checks that no item ships past its ordered quantity (dispatched plus
    delivered, catalogue lines only);
  - claims each packing list (CONFIRMED → SHIPPED, compare-and-set);
  - posts one `FG_DISPATCH` from the ship-from location, consuming the
    order's open reservations there first (oldest first).
- **Partial deliveries** are multiple shipments.
- **Cancelling.** Only drafts can be cancelled.
- **Effect on the sales order.** Cancelling the sales order takes the same
  row lock. It is refused once anything has been dispatched, and it cancels
  draft shipments.

**Atomic stock postings.** Module stock postings run inside the module's
transaction (`postStockDocumentInTransaction`). Sources `QualityInspection`,
`PackingList`, `Shipment` and `StockReservation` cannot be posted through
the public stock API.

**Permissions** (please confirm):
- **Quality:** `quality:view` / `quality:create` / `quality:approve`.
- **Packing:** uses `production:view` / `production:update`. The seed has no
  `packing:*` permissions; `config/roles.js` lists them for the UI only.
- **Dispatch:**
  - `dispatch:view` and `dispatch:create`;
  - `dispatch:ship` to dispatch;
  - `dispatch:update` to deliver or cancel.

**Not implemented:**
- NCR and CAPA records.
- Packing instructions.
- Shipping custom (non-catalogue) sales order lines.
- Proof-of-delivery attachments.
- A sales order "delivered" status. Sales orders stay APPROVED; fulfilment
  is shown per item (ordered / shipped / delivered / remaining).

MRP still counts the full ordered quantity as demand (D-020). Subtracting
shipped quantities is a follow-up.

## D-023: Invoicing and receivables (not a general ledger)

**Scope.** Finance covers customer invoicing and receivables only. There
are no accounts, journals, payables, expenses or financial statements yet.
- **Invoices bill shipped goods.** One active invoice per DISPATCHED or
  DELIVERED shipment, enforced by a partial unique index.
- **Pricing.** Each line takes the quantity shipped and the unit price,
  discount % and tax % of its approved sales order line. No tax rate is
  invented or configured here.
- **Ambiguous pricing.** If an order has the same item at more than one
  price or tax, the invoice is refused (`INVOICE_PRICE_UNRESOLVED`). In
  support of this, dispatch now links a shipment line to a sales order line
  only when the item is on exactly one catalogue line.
- **Arithmetic.** Amounts are exact cents (BigInt), rounded half up at each
  step: gross = quantity × price; discount on gross; tax on
  gross − discount. This is the same rule as sales orders (D-011).
- **Due date.** Invoice date + payment terms (0–365 days), in calendar days.

**Invoice lifecycle.**
- DRAFT → ISSUED, or DRAFT → CANCELLED (with a reason). Each is a
  compare-and-set.
- Issued invoices are never edited, cancelled or deleted. They are
  corrected with credit notes.

**Credit notes.**
- They credit quantities of invoiced lines at the invoiced terms.
- Credits per line never exceed the invoiced quantity. The credit that
  reaches the full quantity takes the exact remaining amounts, so rounding
  can never credit more than was invoiced.
- A credit may not exceed the invoice's outstanding balance. Refunds are
  not supported yet, so void receipts first.
- Credit notes are final.
- Returned goods are received into stock separately (Inventory → Stock In,
  with a reason).

**Receipts.**
- A receipt is posted against one ISSUED invoice and may not exceed the
  outstanding balance.
- Credits and receipts lock the invoice row (`FOR UPDATE`), so concurrent
  postings cannot overpay or over-credit (tested).
- A wrong receipt is voided with a reason, never deleted.

**Balances.**
- Outstanding = total − credit notes − posted receipts.
- Payment status: UNPAID, PARTIALLY_PAID or PAID.
- Receivables are aged by days past the due date: current, 1–30, 31–60,
  61–90, 90+.

**Permissions** (please confirm):
- `finance:view` to see.
- `finance:create` to draft invoices and record receipts.
- `finance:approve` to issue or cancel invoices, issue credit notes and
  void receipts.

**Printing.** Invoice, credit note and receipt print with the company
fields from `config/company.js`. The legal name, address and tax
registration are still empty (D-013) and must be filled in before invoices
are sent to customers.

## D-024: User and role administration

Administration works over the existing RBAC tables, with no schema change:
users, roles, role permissions and the audit log.

**Users**
- Create, edit name and phone, and replace the role set.
- Enable or disable (`users:disable`). Disabling revokes the user's
  sessions.
- An administrator can reset another user's password (`users:update`).
  This revokes that user's sessions.
- Users cannot disable themselves or reset their own password here. Their
  own password is changed from the profile, which requires the current
  one.

**Roles**
- Seeded system roles (`isSystem`) are read-only.
- Custom roles can be created, edited and disabled (`roles:create`,
  `roles:update`) with any seeded permissions.
- Fix: a DISABLED role now grants nothing. Before this change, permission
  resolution ignored role status. Disabled roles cannot be assigned.

**Lockout protection**
- Every access-control change runs under one advisory transaction lock.
- A change is rolled back if it would leave no ACTIVE user holding
  `users:update` through an ACTIVE role.
- This was tested with two administrators removing each other
  concurrently; exactly one change wins.

**Audit log**
- Read-only, filterable by action, entity, actor, date range and text
  (`audit:view`).

**System settings**
- Still a read-only reference page. There are no editable system settings
  yet.

## D-025: Login rate limiting shared across instances

Failed logins are counted per email (5 per 15 minutes) and per client IP
(20 per 15 minutes) in `erp_login_attempt_counters`.
- **Shared and durable.** Each failure is one atomic upsert, so every
  server instance shares the counters and they survive restarts. This
  closes the per-instance gap noted in Phase 0.
- **Privacy.** Keys are SHA-256 hashes of `email:<address>` or
  `ip:<address>`, so raw emails and IPs are not stored.
- **Housekeeping.** Expired rows are deleted on each failure.
- **Success.** A successful login clears the account counter but not the IP
  counter.
- **Proxy caveat.** The client IP still comes from `x-forwarded-for`. That
  is correct behind the hosting proxy, but spoofable if the app is exposed
  directly (Phase 0 risk 4).
- **Memory limiter.** The in-memory limiter now only defines the policy
  defaults and keeps its unit tests.

## D-026: Gate passes

A gate pass authorises goods through the factory gate. It records the
movement, not stock; inventory and dispatch documents post stock.

**Types**
- INWARD.
- OUTWARD_NON_RETURNABLE.
- OUTWARD_RETURNABLE: for example job work or repair. It needs an expected
  return date.

**Lifecycle**
- DRAFT → APPROVED → gate movement, which records the time and the guard.
- After the gate movement the pass is COMPLETED, or OUT for returnable
  passes.
- An OUT pass completes when every line has come back. Partial returns are
  allowed; returning more than went out is refused.
- DRAFT and APPROVED passes can be cancelled with a reason.
- Transitions are compare-and-set, and returns lock the pass row (both
  tested concurrently).
- A pass that is OUT past its return date is shown as overdue.

**Shipments**
- An outward pass may be linked to a dispatched shipment; its lines are
  then copied from that shipment.

**Permissions** (please confirm)
- Uses the inventory permissions, because the seed has no gate permissions.
- `inventory:view` to see passes.
- `inventory:create` to create passes and record gate movements and
  returns.
- `inventory:adjust` to approve or cancel.

**Screens**
- Under Dispatch & Logistics → Gate Passes, with a printable pass.

## D-027: HR and payroll (please confirm the pay rules)

**Permissions (new, in the seed)**
- `hr:view` and `hr:manage` cover employees, departments and attendance,
  without pay.
- `payroll:view` is needed to see pay rates, bank accounts, advances, runs
  and payslips.
- `payroll:process` sets pay, issues advances, and prepares and adjusts
  runs.
- `payroll:approve` approves runs and marks them paid.
- New roles: HR_MANAGER and PAYROLL_OFFICER. The officer cannot approve.
  Admin roles receive everything.
- **Owner action:** run `seedSystemAccessControl()` on the live system to
  add these permissions.
- Pay fields are removed from API responses for users without
  `payroll:view` (tested in Chromium).

**Attendance**
- One record per employee per day, only between the joining and leaving
  dates.
- Statuses: PRESENT, ABSENT, HALF_DAY, PAID_LEAVE, UNPAID_LEAVE, HOLIDAY,
  WEEKLY_OFF. Overtime hours are recorded per day.
- A month's attendance is locked once its payroll is approved. Saving
  attendance and approving payroll share a per-month advisory lock.

**Pay rules** (exact cents, each component rounded half up)
- **Month length.** The month has its calendar days (28–31). Employed days
  are the month's days within the employment dates.
- **Monthly staff**
  - Paid days = employed − absent − unpaid leave − ½ × half days.
  - Days with no record are paid and shown as "unrecorded" on the run and
    payslip.
  - Basic and allowances are each prorated as amount × paid ÷ days in
    month.
- **Daily wage**
  - Paid days = present + paid leave + ½ × half days.
  - Holidays and unrecorded days are unpaid.
  - Pay = rate × paid days, plus prorated monthly allowances.
- **Overtime.** Hours × the employee's hourly rate.
- **Deductions**
  - The fixed monthly deduction is entered per employee. No tax or
    statutory rate (income tax, EOBI, social security) is built in;
    configure these per employee as advised.
  - Advance instalments are then recovered, oldest first.
  - Each deduction is limited so net pay is never negative.
- **Manual adjustment.** A draft line can take one "other earning" and one
  "other deduction" with a note.

**Payroll runs**
- One active run per month (partial unique index).
- DRAFT → APPROVED → PAID. Only drafts can be recalculated, adjusted or
  cancelled.
- Approval recalculates and refuses if attendance, pay rates or advances
  changed since the draft (`PAYROLL_STALE`). It then applies each advance
  recovery once with a conditional update; fully recovered advances close.

**Advances**
- Issued with an instalment and idempotent (unique key).
- Cancellable only before anything is recovered.
- Interest-bearing loans are not supported.

**Prints:** the payroll register and payslips.

**Not implemented:** shifts, leave balances or requests (leave is recorded
on attendance), and HR reports. These pages show a banner. The salary
structure and deductions pages redirect to Employees, where pay is set.

**Please confirm:**
- calendar-day proration, against a fixed 26- or 30-day basis;
- paying monthly staff for unrecorded days;
- daily wagers being unpaid on holidays.

## D-028: Reports, dashboard operations and regression

**Reports**
- 16 reports, each one read-only SQL query over the live tables.
  - Order fulfilment, deliveries, dispatches, packing.
  - Production orders, stage-wise production, completion, wastage, and
    rejections & rework.
  - Quality inspections.
  - Stock position, stock movements, WIP stock, finished-goods stock.
  - Receivables by invoice.
  - Payroll summary.
- Quantities and money stay exact. Totals are summed exactly on the server.
  Percentages are rounded for display only.
- **No stock valuation.** Item costs are not recorded, so no value is
  invented.
- **Export.** `GET /api/reports/[report]?from&to[&format=csv]`. The CSV
  writer is the formula-safe one, and each export is audited. The screen's
  export uses the range of the rows shown.

**Report permissions**
- A report opens with its module's view permission or `reports:view`.
- The payroll summary needs `payroll:view` only.

**Dashboard**
- Production, quality, dispatch and finance are now reported as
  connected.
- An operations panel shows live counts: production in progress and
  overdue, inspections awaiting approval, packed / in transit / delivered,
  and receivables. Each section appears only for users with that module's
  view permission.

**UI polish**
- Procurement placeholder KPIs show "—", not "0".
- Redirect pages opt out of instant validation.
- The top bar no longer logs fetches aborted by navigation.

**Not implemented:** NCR/CAPA reports and financial statements; those
pages keep the banner.

**Regression**
- Every static route (115) was opened in Chromium as an administrator and
  as a view-only user.
- Result: no 5xx responses, no page errors and no console errors.
- The pages that still show a banner are exactly the unimplemented areas
  listed in ERP_MODULE_STATUS.md.

## D-029 Procurement and accounts payable (2026-10-15)

**Scope.** Suppliers, purchase requisitions, RFQs with quote comparison,
purchase orders, goods receipts against POs, supplier bills, supplier
payments, payables ageing and supplier performance. Migration
`20261015T1758_procurement` is additive (new tables only).

**Lifecycles** (every status change is compare-and-set or under a row lock)
- Requisition: DRAFT → SUBMITTED → APPROVED or REJECTED; APPROVED →
  ORDERED when a PO is raised (directly or by awarding an RFQ). Drafts and
  submitted requisitions can be cancelled.
- RFQ: OPEN → AWARDED or CANCELLED. One quote per supplier; recording it
  again replaces it while the RFQ is open. Awarding creates a DRAFT PO at
  the quoted prices and tax; the expected date is today + lead time.
- PO: DRAFT → APPROVED → PARTIALLY_RECEIVED → RECEIVED. Only POs with
  nothing received can be CANCELLED; a partly received PO is CLOSED short
  with a reason.
- Supplier bill: DRAFT → APPROVED; DRAFT, or APPROVED with no posted
  payments, → CANCELLED.
- Supplier payment: POSTED → VOIDED, with a reason.

**MRP link.** Only CONFIRMED BUY planned orders can become requisition
lines. A unique index on `plannedOrderId` stops the same planned order
being requisitioned twice, including under concurrency.

**Goods receipt**
- Locks the PO row (`FOR UPDATE`) and refuses any line that would exceed
  its ordered quantity. Unit precision rules apply (whole pieces for Pcs).
- In the same transaction it posts a GOODS_RECEIPT stock document. If
  "hold for inspection" is ticked, it also posts a QC_HOLD; the existing
  incoming-inspection flow (D-022) releases or scraps the held stock.
- `PurchaseReceipt` is a module-owned stock source and cannot be posted
  directly.
- Idempotent by key.

**Three-way match**
- A bill line against a PO line may not exceed received − billed.
- Approval moves `billedQuantity` by compare-and-set
  (`billedQuantity + q <= receivedQuantity`). Two drafts for the same
  received goods can never both be approved; a check constraint backs this
  up.
- A billed unit price above the PO price is refused at approval. A lower
  price is allowed.
- Cancelling an approved bill returns its billed quantity.
- Bills without a PO (services, expenses) take free-text lines.
- The supplier invoice number is unique per supplier among bills that are
  not cancelled (partial unique index).
- The due date defaults to the bill date plus the supplier's payment
  terms.

**Payments.** A payment locks the bill and may not exceed total − posted
payments. All amounts are exact cents (D-011 rules).

**Payables.** Approved bills less posted payments, aged into the same
buckets as receivables. "Received, not billed" is shown separately as an
estimate at PO prices and is never added to the payable total.

**Supplier performance**
- On-time % = receipts dated on or before the PO's expected date ÷
  receipts on POs that have an expected date.
- Fill rate = received ÷ ordered, on RECEIVED or CLOSED POs only.
- Both are blank until there is history; no figure is invented.

**Permissions** (existing codes; confirm with the owner)
- `purchasing:view`: procurement screens. Finance can also read
  suppliers, POs and bills.
- `purchasing:create`: suppliers, requisitions, RFQs, quotes, POs.
- `purchasing:approve`: approve or reject requisitions, award RFQs,
  approve, cancel or close POs.
- Requisitions can also be raised with `production:update` (planners
  converting MRP suggestions).
- Goods receipts need `purchasing:create` or `inventory:create` (stores).
- Bills: `finance:create` to record; `finance:approve` to approve or
  cancel.
- Payments: `finance:create` to record; `finance:approve` to void.

**Prints.** `/print/purchase-orders/[id]`; drafts and cancelled POs carry
a notice.

**Not included.** Bills and payments do not yet post to a general ledger
(there is none).

## D-030 General ledger (2026-10-15)

**Scope.** Chart of accounts, double-entry journals, automatic postings
from every money document, expenses, other income, cash and bank
transfers, account statements, trial balance, profit and loss and balance
sheet. Migration `20261015T1829_general_ledger` is additive.

**Integrity**
- Every journal line has exactly one positive side, in whole cents (check
  constraints).
- An entry's debits equal its credits. The service enforces this and the
  test suite checks every entry in the database.
- Entries are never edited or deleted. A correction is a reversing entry:
  one per entry (unique `reversesEntryId`), never dated before the
  original.
- Automatic entries carry (sourceType, sourceId, sourceEvent). A partial
  unique index and an advisory lock make each document event post once,
  even when the same request arrives concurrently.

**System accounts.** These are created on first use and used by the
automatic postings:

| Code | Account |
| --- | --- |
| 1000 | Cash in hand |
| 1010 | Bank |
| 1100 | Accounts receivable |
| 1200 | Staff advances |
| 1300 | Input tax recoverable |
| 2000 | Accounts payable |
| 2100 | Output tax payable |
| 2200 | Salaries payable |
| 2210 | Payroll deductions payable |
| 3000 | Owner's equity and opening balances |
| 3100 | Retained earnings |
| 4000 | Sales |
| 4900 | Other income |
| 5000 | Purchases |
| 6000 | Salaries and wages |
| 6900 | General expenses |

- They can be renamed but not deactivated. Other accounts are added
  freely and deactivated, never deleted.
- These are configuration, not business records; no balances are seeded.
  Opening balances are entered as a manual journal against 3000.

**Automatic postings.** Each one is made inside the document's own
transaction, so the document and its entry commit or fail together.

| Document | Entry |
| --- | --- |
| Invoice issued | Dr AR (total) / Cr Sales (net of discount), Cr Output tax |
| Credit note | The reverse of an invoice, for the credited amounts |
| Customer receipt | Dr Cash if the method is CASH, otherwise Bank / Cr AR. A void reverses it. |
| Supplier bill approved | Dr Purchases (PO lines) or General expenses (other lines), Dr Input tax / Cr AP. Cancelling an approved bill reverses it. |
| Supplier payment | Dr AP / Cr Cash or Bank (by method). A void reverses it. |
| Salary advance | Dr Staff advances / Cr Cash. Cancellation reverses it. |
| Payroll approved | Dated the last day of the period. Dr Salaries (gross) / Cr Staff advances (recovered), Cr Payroll deductions payable, Cr Salaries payable (net) |
| Payroll paid | Dr Salaries payable / Cr Bank |
| Expense, income, transfer | The chosen accounts. A void reverses it. |

**Earlier documents.** "Post earlier documents" posts every document
recorded before the ledger existed, with that document's own dates. It is
idempotent and audited, and needs `finance:approve`.

**Not modelled; owner to confirm**
- Stock is not valued in the ledger. Purchases are expensed when billed,
  and there is no inventory asset or cost of goods sold.
- There is no period close or lock. Current earnings show on the balance
  sheet until a closing journal moves them to 3100.
- There is a single currency.
- Advances are paid from Cash in hand. Receipts and payments by any
  method other than CASH go to the one system Bank account; reclassify
  with a manual journal if you use several banks.

**Permissions**
- `finance:view` reads accounts, journals and statements.
- `finance:create` records expenses, income and transfers.
- `finance:approve` creates or edits accounts, posts or reverses manual
  journals, voids cash transactions, and runs the backfill.

## D-031 Non-conformance reports and CAPA (2026-10-15)

**NCR lifecycle.** OPEN → INVESTIGATING → CLOSED. An open or
investigating NCR can also be CANCELLED, with a reason.
- An NCR closes only when:
  - it has a root cause and a disposition (rework, scrap, use as is,
    return to supplier, regrade); and
  - every action on it is VERIFIED or CANCELLED.
- It can be cancelled only when every action on it is cancelled.
- Investigation fields are frozen once it is closed.

**NCR links.** An NCR can link to an item, a production order, an
inspection, a supplier and a customer. Each link is checked when the NCR
is raised.

**CAPA lifecycle.** OPEN → IN_PROGRESS → DONE → VERIFIED.
- "Not effective" sends a DONE action back to IN_PROGRESS.
- OPEN and IN_PROGRESS actions can be cancelled.
- An action is overdue when it is open or in progress past its due date.
- Actions cannot be added to a closed NCR.

**Reports.** `quality-ncr` and `quality-capa` were added to the report
registry, so they have date filters and CSV export.

**Permissions**
- `quality:create` raises, edits and starts or completes actions.
- `quality:approve` closes or cancels NCRs, and verifies, sends back or
  cancels actions.

## D-032 Shifts and leave (2026-10-15)

**Shifts**
- A shift has a start, an end and a break. An end time earlier than the
  start is an overnight shift.
- Paid minutes are shown for each shift.
- Each employee can be assigned one shift (nullable `shiftId`).
- Attendance and overtime are still recorded per day.

**Leave types.** Each type is paid or unpaid, with annual days.
0 annual days means the type is not limited and no balance is tracked.

**Leave requests**
- A request counts the dates in its range that are not company holidays
  or shutdowns on the planning calendar.
- Weekly off days are counted. Confirm this with the owner.

**Approval.** Approval runs in one transaction under the employee's lock
and the payroll-period locks. It refuses:
- an overlapping pending or approved request;
- going over the year's entitlement;
- a payroll period that is already approved;
- dates already marked present or half day.

It then writes PAID_LEAVE or UNPAID_LEAVE attendance, so payroll picks
the leave up.

**Cancelling an approved request** removes only the attendance it wrote
(remark `Leave <number>`), and only while the period is still open.

**Permissions.** `hr:manage` manages shifts and leave; `hr:view` reads
them.

## D-033 Product catalogue extras (2026-10-15)

**Categories**
- The category is still text on each product, so the item form is
  unchanged.
- The category register adds a description and a status, and lists
  categories that are used but not registered.
- Renaming a registered category renames it on every product in the same
  transaction.

**Variants.** There is no separate variant table: every specification
combination is its own SKU (fastener categories are never merged). The
variants page groups SKUs by category, item type and name, and shows the
attributes that differ.

**Pricing**
- Every change records the previous price, the new price, the effective
  date, the reason and who made it.
- This includes edits on the item form.
- Bulk percentage changes by category preview first and round half up to
  6 decimals.
- Existing sales orders keep their prices.

**Documents**
- Files are stored in the database (`bytea`), 5 MB each.
- Allowed types are PDF, PNG, JPEG, WebP, text and CSV. The file's bytes
  must match the declared type.
- A SHA-256 checksum is recorded and file names are sanitised.
- Downloads use `nosniff`, a sandboxing CSP and `attachment` by default.
- Documents are archived, never deleted.

**Permissions.** `products:update` changes categories, prices and
documents; `products:view` reads them.

## D-034 Planning, packing instructions and batches (2026-10-15)

**Work centres**
- There is one work centre per production stage, with capacity per shift
  in one unit and 1–3 shifts per day.
- Load is the quantity still to pass each stage of open production
  orders.
- Load is compared only in the capacity's unit. Other units are listed,
  never converted or added.
- Utilisation = days of work ÷ working days in the horizon.

**Calendar**
- Weekly off days come from the D-035 setting.
- Dated overrides are holiday, shutdown or extra working day.
- The month view shows production orders due, customer deliveries due and
  supplier deliveries expected.

**Production plans**
- DRAFT plans are editable. A plan then goes to APPROVED, and on to
  CLOSED, which cancels lines not yet released. Draft plans can be
  cancelled.
- Line due dates must fall inside the plan period, and quantities follow
  the unit precision rules.
- Releasing a line creates the production order, with its nine stages,
  in the same transaction that marks the line released. It happens at
  most once per line, even concurrently.
- `insertProductionOrderInTransaction` was extracted from
  `createProductionOrder` for this; its behaviour is unchanged.
- Each plan shows a capacity check for that plan alone.

**Packing instructions**
- An instruction gives the pack type, units per pack, packs per carton,
  carton and labelling, as a default or for one customer.
- Partial unique indexes allow one active instruction per item and
  customer, and one active default per item.
- A customer's instruction wins over the item's default.

**Batch register**
- A batch is a quantity of one item from one source: a production order,
  a goods receipt (with the supplier lot) or opening stock.
- Batches never exceed the source quantity. The source is locked, and
  rejected batches do not count.
- Status moves only forward: ACTIVE, ON_HOLD, RELEASED, REJECTED,
  CONSUMED.
- The batch view traces to the production order, the receipt, PO and
  supplier, the inspections and related NCRs.
- **Limitation:** stock balances are not split by batch, and shipments
  do not record batches.

**Permissions**
- Planning and packing instructions: `production:view` to read,
  `production:create` or `production:update` to change.
- Batches: `inventory:create` or `quality:create` to register;
  `quality:approve` to hold, release or reject.

## D-035 Settings (2026-10-15)

**Storage.** Settings are stored in `erp_app_settings` as validated JSON
per key. Every change is audited.

**`company.profile`**
- Every print now reads this through `useCompany()`, falling back to
  `config/company.js`.
- No company details are invented: until the owner fills them in, only
  the trading name prints.

**`planning.weeklyOff`.** The default is Sunday, flagged as "Default"
until saved.

**Permissions.** `roles:update` edits settings and `roles:view` reads the
list. The company profile is readable by any signed-in user.

**Banner list.** The module-availability list is now empty: every area
in the navigation has its API and tables.

## D-036 AI entry assistant (2026-10-16)

**What it does.** A panel on every ERP page ("AI entry") where staff
type what happened (it replies in English; Urdu and Roman Urdu input is understood). Claude
(`claude-opus-5-5`, server-side fallback `"default"`) prepares the
matching entry. It can prepare six kinds:
- customers
- suppliers
- draft sales orders
- draft purchase requisitions
- expenses, income and cash/bank transfers
- leave requests

**Claude never writes.**
- Read-only lookup tools find customers, items, suppliers, employees,
  leave types and accounts. Each lookup checks the user's own view
  permission.
- Propose tools build the exact JSON body of the existing API route. The
  body is validated with that route's own zod schema, and the ids are
  checked to exist.
- The user reviews each proposal on a card and presses **Confirm**. The
  browser then posts the body to the normal route with the user's
  session, so permissions, validation, idempotency and audit apply
  unchanged.
- Entries that create money or stock movements carry an idempotency key,
  so a double confirm saves once.

**Who sees it.** Only users whose role allows at least one of the six
entries. Tools are filtered per user, and the server re-checks
permissions on every tool call.

**Conversation storage.** The conversation lives in the browser
(sessionStorage) and is sent back each turn. It is capped at 200 messages
and 600 KB.

**Setup.** Without `ANTHROPIC_API_KEY` in the server environment, the
panel says the assistant is not set up. It never answers with made-up
data.

**Not covered.** Approvals, stock posting, invoices and payroll stay on
their screens. The assistant names the screen to use.

**Tests.** `tests/server/assistant.db.test.mjs` covers:
- permission filtering
- real lookups
- every proposal body accepted by the real service
- invalid input refused
- cash-entry idempotency
- the not-configured error

A browser run on the isolated test database confirmed that Confirm saves
through the normal route.
