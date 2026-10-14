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
