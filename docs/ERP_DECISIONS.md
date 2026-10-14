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

## D-004: Scrap/yield convention for BOM (proposed, Phase 4)

Component scrap is a percentage on the component line:
`gross = net × (1 + scrap%)`. It is applied exactly once, at explosion of that
line. A parent yield, if modelled, divides the parent requirement before
explosion, and is never combined with component scrap on the same quantity.

## D-005: Stage quantity rule (proposed, Phase 5)

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
