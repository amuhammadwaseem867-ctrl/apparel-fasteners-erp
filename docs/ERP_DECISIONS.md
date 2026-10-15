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
