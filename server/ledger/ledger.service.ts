/*
 * General ledger (D-030): chart of accounts, double-entry journals,
 * cash/bank transactions and financial statements.
 *
 * Entries are never edited or deleted. A mistake is corrected by a
 * reversing entry (one per entry) and a new entry. Automatic postings from
 * other modules carry (sourceType, sourceId, sourceEvent), which is unique,
 * so a document can never post twice even under concurrency.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import { type AccountType, cents, entryProblem, entryTotal, fromCents, normalBalance, reverseLines } from "./ledger-rules";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const today = () => new Date().toISOString().slice(0, 10);

async function rows<T>(tx: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

/*
 * Accounts the automatic postings need. They are configuration, not
 * business records: created on first use with these codes, renamable,
 * never deletable, and reported as "system" accounts.
 */
export const SYSTEM_ACCOUNTS = [
  { systemKey: "CASH", code: "1000", name: "Cash in hand", accountType: "ASSET", isCashBank: true },
  { systemKey: "BANK", code: "1010", name: "Bank", accountType: "ASSET", isCashBank: true },
  { systemKey: "AR", code: "1100", name: "Accounts receivable", accountType: "ASSET", isCashBank: false },
  { systemKey: "STAFF_ADVANCES", code: "1200", name: "Staff advances", accountType: "ASSET", isCashBank: false },
  { systemKey: "INPUT_TAX", code: "1300", name: "Input tax recoverable", accountType: "ASSET", isCashBank: false },
  { systemKey: "AP", code: "2000", name: "Accounts payable", accountType: "LIABILITY", isCashBank: false },
  { systemKey: "OUTPUT_TAX", code: "2100", name: "Output tax payable", accountType: "LIABILITY", isCashBank: false },
  { systemKey: "SALARIES_PAYABLE", code: "2200", name: "Salaries payable", accountType: "LIABILITY", isCashBank: false },
  { systemKey: "PAYROLL_DEDUCTIONS", code: "2210", name: "Payroll deductions payable", accountType: "LIABILITY", isCashBank: false },
  { systemKey: "OWNER_EQUITY", code: "3000", name: "Owner's equity and opening balances", accountType: "EQUITY", isCashBank: false },
  { systemKey: "RETAINED_EARNINGS", code: "3100", name: "Retained earnings", accountType: "EQUITY", isCashBank: false },
  { systemKey: "SALES", code: "4000", name: "Sales", accountType: "INCOME", isCashBank: false },
  { systemKey: "OTHER_INCOME", code: "4900", name: "Other income", accountType: "INCOME", isCashBank: false },
  { systemKey: "PURCHASES", code: "5000", name: "Purchases", accountType: "EXPENSE", isCashBank: false },
  { systemKey: "SALARIES", code: "6000", name: "Salaries and wages", accountType: "EXPENSE", isCashBank: false },
  { systemKey: "GENERAL_EXPENSES", code: "6900", name: "General expenses", accountType: "EXPENSE", isCashBank: false },
] as const;
export type SystemKey = (typeof SYSTEM_ACCOUNTS)[number]["systemKey"];

export async function ensureSystemAccounts(tx: Tx | ReturnType<typeof db.runtime>) {
  const [present] = await rows<{ count: string }>(tx, db.raw.sql`select count(*)::text as count from erp_ledger_accounts where "systemKey" is not null`.returnsRow({ count: "pg/text@1" }).build());
  if (Number(present.count) >= SYSTEM_ACCOUNTS.length) return;
  for (const account of SYSTEM_ACCOUNTS) {
    await tx.query(db.raw.sql`
      insert into erp_ledger_accounts (id, code, name, "accountType", "systemKey", "isCashBank")
      values (gen_random_uuid(), ${account.code}, ${account.name}, ${account.accountType}, ${account.systemKey}, ${account.isCashBank})
      on conflict do nothing
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build());
  }
}

async function systemAccountIds(tx: Tx) {
  const found = await tx.orm.public.LedgerAccount.where((account) => account.systemKey.in(SYSTEM_ACCOUNTS.map((item) => item.systemKey))).all();
  if (found.length < SYSTEM_ACCOUNTS.length) {
    await ensureSystemAccounts(tx);
    const again = await tx.orm.public.LedgerAccount.where((account) => account.systemKey.in(SYSTEM_ACCOUNTS.map((item) => item.systemKey))).all();
    const missing = SYSTEM_ACCOUNTS.filter((item) => !again.some((account) => account.systemKey === item.systemKey));
    if (missing.length) {
      throw new AppError(`System ledger account ${missing[0].code} (${missing[0].name}) could not be created; its code is taken by another account.`, { code: "SYSTEM_ACCOUNT_MISSING", status: 409 });
    }
    return new Map(again.map((account) => [account.systemKey as SystemKey, account.id]));
  }
  return new Map(found.map((account) => [account.systemKey as SystemKey, account.id]));
}

/* ------------------------------------------------------------------ */
/* Posting                                                             */
/* ------------------------------------------------------------------ */

export type PostingLine = { account: SystemKey | { id: string }; debit?: string; credit?: string; memo?: string | null };
export type Source = { type: string; id: string; event: string };

/*
 * Posts one balanced entry inside the caller's transaction. With a source
 * it is idempotent: the same (type, id, event) returns the existing entry.
 */
export async function postEntry(tx: Tx, input: { date: string; description: string; lines: PostingLine[]; source?: Source; idempotencyKey?: string; reversesEntryId?: string }, actorId: string) {
  const lines = input.lines.map((line) => ({ ...line, debit: line.debit ?? "0", credit: line.credit ?? "0" }));
  const problem = entryProblem(lines);
  if (problem) throw new AppError(problem, { code: "JOURNAL_UNBALANCED", status: 400 });

  if (input.source) {
    await tx.query(db.raw.sql`select pg_advisory_xact_lock(hashtext(${`je:${input.source.type}:${input.source.id}:${input.source.event}`}))::text as locked`.returnsRow({ locked: "pg/text@1" }).build());
    const existing = await tx.orm.public.JournalEntry.where({ sourceType: input.source.type, sourceId: input.source.id, sourceEvent: input.source.event }).first();
    if (existing) return existing.id;
  }

  const system = lines.some((line) => typeof line.account === "string") ? await systemAccountIds(tx) : new Map<SystemKey, string>();
  const accountIds = lines.map((line) => (typeof line.account === "string" ? system.get(line.account)! : line.account.id));
  const accounts = await tx.orm.public.LedgerAccount.where((account) => account.id.in([...new Set(accountIds)])).all();
  for (const [index, id] of accountIds.entries()) {
    const account = accounts.find((item) => item.id === id);
    if (!account) throw new AppError(`Line ${index + 1}: account not found.`, { code: "ACCOUNT_NOT_FOUND", status: 400 });
    if (account.status !== "ACTIVE" && !input.source) throw new AppError(`Line ${index + 1}: ${account.code} ${account.name} is inactive.`, { code: "ACCOUNT_INACTIVE", status: 409 });
  }

  const entryNumber = await allocateDocumentNumber(tx, "JE");
  const entry = await tx.orm.public.JournalEntry.create({
    entryNumber, entryDate: input.date, description: input.description,
    sourceType: input.source?.type ?? null, sourceId: input.source?.id ?? null, sourceEvent: input.source?.event ?? null,
    reversesEntryId: input.reversesEntryId ?? null,
    totalAmount: entryTotal(lines),
    idempotencyKey: input.idempotencyKey ?? (input.source ? `je:${input.source.type}:${input.source.id}:${input.source.event}` : crypto.randomUUID()),
    createdBy: actorId,
  });
  for (const [index, line] of lines.entries()) {
    await tx.orm.public.JournalLine.create({
      entryId: entry.id, lineNo: index + 1, accountId: accountIds[index],
      debit: fromCents(cents(line.debit)), credit: fromCents(cents(line.credit)), memo: line.memo ?? null,
    });
  }
  return entry.id;
}

/* Reverses one posted entry (once), dated `date`. Returns the reversal's id. */
export async function reverseEntryInTransaction(tx: Tx, entryId: string, date: string, description: string, actorId: string, source?: Source) {
  const [locked] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_journal_entries where id = ${entryId}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
  if (!locked) throw new AppError("Journal entry not found.", { code: "JOURNAL_NOT_FOUND", status: 404 });
  if (locked.status !== "POSTED") throw new AppError("This entry has already been reversed.", { code: "JOURNAL_ALREADY_REVERSED", status: 409 });
  const original = await tx.orm.public.JournalLine.where({ entryId }).orderBy((line) => line.lineNo.asc()).all();
  const reversal = await postEntry(tx, {
    date, description, source, reversesEntryId: entryId,
    lines: reverseLines(original.map((line) => ({ account: { id: line.accountId }, debit: String(line.debit), credit: String(line.credit), memo: line.memo }))),
  }, actorId);
  await tx.orm.public.JournalEntry.where({ id: entryId }).update({ status: "REVERSED" });
  return reversal;
}

/* Reverses the entry a source event posted, if there is one (idempotent). */
export async function reverseSourcePosting(tx: Tx, source: Source, reversalEvent: string, description: string, actorId: string, date = today()) {
  const entry = await tx.orm.public.JournalEntry.where({ sourceType: source.type, sourceId: source.id, sourceEvent: source.event }).first();
  if (!entry) return null;
  const done = await tx.orm.public.JournalEntry.where({ sourceType: source.type, sourceId: source.id, sourceEvent: reversalEvent }).first();
  if (done) return done.id;
  // Never dated before the entry it reverses (a void of a post-dated document).
  const effective = date < entry.entryDate ? entry.entryDate : date;
  return reverseEntryInTransaction(tx, entry.id, effective, description, actorId, { ...source, event: reversalEvent });
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

type BalanceRow = { id: string; code: string; name: string; accountType: string; systemKey: string; isCashBank: string; status: string; description: string; debit: string; credit: string };

async function balances(asOf: string, from = "") {
  await ensureSystemAccounts(db.runtime());
  return rows<BalanceRow>(db.runtime(), db.raw.sql`
    select a.id::text as id, a.code, a.name, a."accountType", coalesce(a."systemKey", '') as "systemKey", a."isCashBank"::text as "isCashBank", a.status,
      coalesce(a.description, '') as description,
      coalesce(sum(l.debit) filter (where e.id is not null), 0)::text as debit,
      coalesce(sum(l.credit) filter (where e.id is not null), 0)::text as credit
    from erp_ledger_accounts a
    left join erp_journal_lines l on l."accountId" = a.id
    left join erp_journal_entries e on e.id = l."entryId" and e."entryDate" <= ${asOf} and (${from} = '' or e."entryDate" >= ${from})
    group by a.id
    order by a.code
  `.returnsRow({ id: "pg/text@1", code: "pg/text@1", name: "pg/text@1", accountType: "pg/text@1", systemKey: "pg/text@1", isCashBank: "pg/text@1", status: "pg/text@1", description: "pg/text@1", debit: "pg/text@1", credit: "pg/text@1" }).build());
}

const shape = (row: BalanceRow) => ({
  id: row.id, code: row.code, name: row.name, accountType: row.accountType as AccountType, systemKey: row.systemKey || null,
  isCashBank: row.isCashBank === "true", status: row.status, description: row.description || null,
  debit: fromCents(cents(row.debit)), credit: fromCents(cents(row.credit)),
  balance: normalBalance(row.accountType as AccountType, row.debit, row.credit),
});

export async function listAccounts(asOf = today()) {
  return (await balances(asOf)).map(shape);
}

export async function createAccount(input: { code: string; name: string; accountType: AccountType; isCashBank: boolean; description?: string }, actorId: string) {
  if (input.isCashBank && input.accountType !== "ASSET") throw new AppError("Cash and bank accounts are assets.", { code: "ACCOUNT_TYPE_INVALID", status: 400 });
  try {
    const account = await db.orm.public.LedgerAccount.create({ code: input.code, name: input.name, accountType: input.accountType, isCashBank: input.isCashBank, description: input.description || null, createdBy: actorId });
    await recordAuditEvent({ actorId, action: "LEDGER_ACCOUNT_CREATED", entityType: "LedgerAccount", entityId: account.id, metadata: { code: input.code } });
    return account;
  } catch (error) {
    if ((findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505") throw new AppError("An account with that code already exists.", { code: "ACCOUNT_EXISTS", status: 409 });
    throw error;
  }
}

/* Name, description and status only; type and code are fixed once used. */
export async function updateAccount(id: string, input: { name: string; description?: string; status: "ACTIVE" | "INACTIVE" }, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Account not found.", { code: "ACCOUNT_NOT_FOUND", status: 404 });
  const account = await db.orm.public.LedgerAccount.where({ id }).first();
  if (!account) throw new AppError("Account not found.", { code: "ACCOUNT_NOT_FOUND", status: 404 });
  if (account.systemKey && input.status === "INACTIVE") throw new AppError("System accounts are used by automatic postings and cannot be deactivated.", { code: "ACCOUNT_SYSTEM", status: 409 });
  await db.orm.public.LedgerAccount.where({ id }).update({ name: input.name, description: input.description || null, status: input.status });
  await recordAuditEvent({ actorId, action: "LEDGER_ACCOUNT_UPDATED", entityType: "LedgerAccount", entityId: id, metadata: { status: input.status } });
  return db.orm.public.LedgerAccount.where({ id }).first();
}

/* Opening balance, every posted line in the range with a running balance. */
export async function getAccountLedger(id: string, from: string, to: string) {
  if (!UUID.test(id)) throw new AppError("Account not found.", { code: "ACCOUNT_NOT_FOUND", status: 404 });
  const account = await db.orm.public.LedgerAccount.where({ id }).first();
  if (!account) throw new AppError("Account not found.", { code: "ACCOUNT_NOT_FOUND", status: 404 });
  const type = account.accountType as AccountType;
  const [opening] = await rows<{ debit: string; credit: string }>(db.runtime(), db.raw.sql`
    select coalesce(sum(l.debit), 0)::text as debit, coalesce(sum(l.credit), 0)::text as credit
    from erp_journal_lines l join erp_journal_entries e on e.id = l."entryId"
    where l."accountId" = ${id}::uuid and e."entryDate" < ${from}
  `.returnsRow({ debit: "pg/text@1", credit: "pg/text@1" }).build());
  const lines = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select e.id::text as "entryId", e."entryNumber", e."entryDate", e.description, coalesce(e."sourceType", '') as "sourceType", coalesce(e."sourceId"::text, '') as "sourceId",
      l.debit::text as debit, l.credit::text as credit, coalesce(l.memo, '') as memo
    from erp_journal_lines l join erp_journal_entries e on e.id = l."entryId"
    where l."accountId" = ${id}::uuid and e."entryDate" >= ${from} and e."entryDate" <= ${to}
    order by e."entryDate", e."entryNumber", l."lineNo"
    limit 2001
  `.returnsRow({ entryId: "pg/text@1", entryNumber: "pg/text@1", entryDate: "pg/text@1", description: "pg/text@1", sourceType: "pg/text@1", sourceId: "pg/text@1", debit: "pg/text@1", credit: "pg/text@1", memo: "pg/text@1" }).build());
  let running = cents(normalBalance(type, opening.debit, opening.credit));
  const sign = type === "ASSET" || type === "EXPENSE" ? 1n : -1n;
  const shown = lines.slice(0, 2000).map((line) => {
    running += sign * (cents(line.debit) - cents(line.credit));
    return { ...line, debit: fromCents(cents(line.debit)), credit: fromCents(cents(line.credit)), balance: fromCents(running) };
  });
  return {
    account: { ...account }, from, to,
    openingBalance: normalBalance(type, opening.debit, opening.credit),
    closingBalance: fromCents(running),
    lines: shown,
    truncated: lines.length > 2000,
  };
}

/* ------------------------------------------------------------------ */
/* Journals                                                            */
/* ------------------------------------------------------------------ */

export async function postManualJournal(input: { entryDate: string; description: string; lines: Array<{ accountId: string; debit: number; credit: number; memo?: string }>; idempotencyKey: string }, actorId: string) {
  const replay = await db.orm.public.JournalEntry.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getJournalEntry(replay.id);
  try {
    const id = await db.transaction(async (tx) => {
      const entryId = await postEntry(tx, {
        date: input.entryDate, description: input.description, idempotencyKey: input.idempotencyKey,
        lines: input.lines.map((line) => ({ account: { id: line.accountId }, debit: toPlainDecimalString(line.debit), credit: toPlainDecimalString(line.credit), memo: line.memo || null })),
      }, actorId);
      await recordAuditEvent({ actorId, action: "JOURNAL_POSTED", entityType: "JournalEntry", entityId: entryId, metadata: { lines: input.lines.length } }, tx);
      return entryId;
    });
    return getJournalEntry(id);
  } catch (error) {
    if ((findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505") {
      const original = await db.orm.public.JournalEntry.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getJournalEntry(original.id);
    }
    throw error;
  }
}

/* Manual entries are reversed here; automatic ones by their documents. */
export async function reverseManualJournal(id: string, date: string, reason: string, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Journal entry not found.", { code: "JOURNAL_NOT_FOUND", status: 404 });
  const entry = await db.orm.public.JournalEntry.where({ id }).first();
  if (!entry) throw new AppError("Journal entry not found.", { code: "JOURNAL_NOT_FOUND", status: 404 });
  if (entry.sourceType) throw new AppError("This entry was posted by a document; void or cancel that document instead.", { code: "JOURNAL_AUTOMATIC", status: 409 });
  if (entry.reversesEntryId) throw new AppError("A reversal cannot itself be reversed; post a new entry instead.", { code: "JOURNAL_IS_REVERSAL", status: 409 });
  if (date < entry.entryDate) throw new AppError(`A reversal cannot be dated before the entry it reverses (${entry.entryDate}).`, { code: "JOURNAL_REVERSAL_DATE", status: 400 });
  const reversal = await db.transaction(async (tx) => {
    const reversalId = await reverseEntryInTransaction(tx, id, date, `Reversal of ${entry.entryNumber}: ${reason}`, actorId);
    await recordAuditEvent({ actorId, action: "JOURNAL_REVERSED", entityType: "JournalEntry", entityId: id, metadata: { reason, reversalId } }, tx);
    return reversalId;
  });
  return getJournalEntry(reversal);
}

export async function getJournalEntry(id: string) {
  if (!UUID.test(id)) throw new AppError("Journal entry not found.", { code: "JOURNAL_NOT_FOUND", status: 404 });
  const entry = await db.orm.public.JournalEntry.where({ id }).first();
  if (!entry) throw new AppError("Journal entry not found.", { code: "JOURNAL_NOT_FOUND", status: 404 });
  const lines = await db.orm.public.JournalLine.where({ entryId: id }).orderBy((line) => line.lineNo.asc()).all();
  const accounts = await db.orm.public.LedgerAccount.where((account) => account.id.in(lines.map((line) => line.accountId))).all();
  const reversedBy = await db.orm.public.JournalEntry.where({ reversesEntryId: id }).first();
  const reverses = entry.reversesEntryId ? await db.orm.public.JournalEntry.where({ id: entry.reversesEntryId }).first() : null;
  return {
    ...entry, totalAmount: fromCents(cents(String(entry.totalAmount))),
    reversedBy: reversedBy ? { id: reversedBy.id, entryNumber: reversedBy.entryNumber } : null,
    reverses: reverses ? { id: reverses.id, entryNumber: reverses.entryNumber } : null,
    lines: lines.map((line) => {
      const account = accounts.find((item) => item.id === line.accountId);
      return { ...line, debit: fromCents(cents(String(line.debit))), credit: fromCents(cents(String(line.credit))), accountCode: account?.code ?? null, accountName: account?.name ?? null };
    }),
  };
}

export async function listJournalEntries(filters: { from: string; to: string; search: string; source: string; page: number; pageSize: number }) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select e.id::text as id, e."entryNumber", e."entryDate", e.description, coalesce(e."sourceType", '') as "sourceType", coalesce(e."sourceId"::text, '') as "sourceId",
      coalesce(e."sourceEvent", '') as "sourceEvent", e.status, e."totalAmount"::text as "totalAmount", (e."reversesEntryId" is not null)::text as "isReversal"
    from erp_journal_entries e
    where (${filters.from} = '' or e."entryDate" >= ${filters.from}) and (${filters.to} = '' or e."entryDate" <= ${filters.to})
      and (${filters.source} = '' or (${filters.source} = 'MANUAL' and e."sourceType" is null) or e."sourceType" = ${filters.source})
      and (${filters.search} = '' or e."entryNumber" ilike ${pattern} or e.description ilike ${pattern})
    order by e."entryDate" desc, e."entryNumber" desc
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", entryNumber: "pg/text@1", entryDate: "pg/text@1", description: "pg/text@1", sourceType: "pg/text@1", sourceId: "pg/text@1", sourceEvent: "pg/text@1", status: "pg/text@1", totalAmount: "pg/text@1", isReversal: "pg/text@1" }).build());
  return {
    entries: result.slice(0, filters.pageSize).map((row) => ({ ...row, totalAmount: fromCents(cents(row.totalAmount)), isReversal: row.isReversal === "true", sourceType: row.sourceType || null })),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* Cash and bank: expenses, other income, transfers                     */
/* ------------------------------------------------------------------ */

export async function recordCashTransaction(input: { kind: "EXPENSE" | "INCOME" | "TRANSFER"; transactionDate: string; cashAccountId: string; counterAccountId: string; amount: number; payee?: string; reference?: string; description: string; idempotencyKey: string }, actorId: string) {
  const replay = await db.orm.public.CashTransaction.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getCashTransaction(replay.id);
  const amount = toPlainDecimalString(input.amount);
  if (input.cashAccountId === input.counterAccountId) throw new AppError("Choose two different accounts.", { code: "CASH_SAME_ACCOUNT", status: 400 });
  const cashAccount = await db.orm.public.LedgerAccount.where({ id: input.cashAccountId }).first();
  const counter = await db.orm.public.LedgerAccount.where({ id: input.counterAccountId }).first();
  if (!cashAccount?.isCashBank || cashAccount.status !== "ACTIVE") throw new AppError("Choose an active cash or bank account.", { code: "CASH_ACCOUNT_INVALID", status: 400 });
  const expected = { EXPENSE: ["EXPENSE", "ASSET", "LIABILITY"], INCOME: ["INCOME", "LIABILITY", "EQUITY"], TRANSFER: ["ASSET"] }[input.kind];
  if (!counter || counter.status !== "ACTIVE" || !expected.includes(counter.accountType) || (input.kind === "TRANSFER" && !counter.isCashBank)) {
    throw new AppError(input.kind === "TRANSFER" ? "Transfer to another active cash or bank account." : `Choose an active ${input.kind === "EXPENSE" ? "expense" : "income"} account.`, { code: "COUNTER_ACCOUNT_INVALID", status: 400 });
  }
  try {
    const id = await db.transaction(async (tx) => {
      const transactionNumber = await allocateDocumentNumber(tx, { EXPENSE: "EXP", INCOME: "INC", TRANSFER: "TRF" }[input.kind]);
      const row = await tx.orm.public.CashTransaction.create({
        transactionNumber, kind: input.kind, transactionDate: input.transactionDate, cashAccountId: input.cashAccountId, counterAccountId: input.counterAccountId,
        amount, payee: input.payee || null, reference: input.reference || null, description: input.description, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      // Expense: money leaves the cash account. Income: it arrives. Transfer: cash account -> counter account.
      const intoCash = input.kind === "INCOME";
      const entryId = await postEntry(tx, {
        date: input.transactionDate, description: `${transactionNumber} ${input.description}`,
        source: { type: "CashTransaction", id: row.id, event: "POSTED" },
        lines: [
          { account: { id: input.counterAccountId }, ...(intoCash ? { credit: amount } : { debit: amount }), memo: input.payee || null },
          { account: { id: input.cashAccountId }, ...(intoCash ? { debit: amount } : { credit: amount }), memo: input.reference || null },
        ],
      }, actorId);
      await tx.orm.public.CashTransaction.where({ id: row.id }).update({ journalEntryId: entryId });
      await recordAuditEvent({ actorId, action: `CASH_${input.kind}_POSTED`, entityType: "CashTransaction", entityId: row.id, metadata: { transactionNumber, amount } }, tx);
      return row.id;
    });
    return getCashTransaction(id);
  } catch (error) {
    if ((findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505") {
      const original = await db.orm.public.CashTransaction.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getCashTransaction(original.id);
    }
    throw error;
  }
}

export async function voidCashTransaction(id: string, reason: string, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Transaction not found.", { code: "CASH_TRANSACTION_NOT_FOUND", status: 404 });
  await db.transaction(async (tx) => {
    const updated = await rows<{ number: string }>(tx, db.raw.sql`
      update erp_cash_transactions set status = 'VOIDED', "voidedBy" = ${actorId}::uuid, "voidedAt" = now(), "voidReason" = ${reason}
      where id = ${id}::uuid and status = 'POSTED' returning "transactionNumber" as number
    `.returnsRow({ number: "pg/text@1" }).build());
    if (!updated.length) {
      if (!(await tx.orm.public.CashTransaction.where({ id }).first())) throw new AppError("Transaction not found.", { code: "CASH_TRANSACTION_NOT_FOUND", status: 404 });
      throw new AppError("This transaction is already voided.", { code: "CASH_TRANSACTION_VOIDED", status: 409 });
    }
    await reverseSourcePosting(tx, { type: "CashTransaction", id, event: "POSTED" }, "VOIDED", `Void ${updated[0].number}: ${reason}`, actorId);
    await recordAuditEvent({ actorId, action: "CASH_TRANSACTION_VOIDED", entityType: "CashTransaction", entityId: id, metadata: { reason } }, tx);
  });
  return getCashTransaction(id);
}

export async function getCashTransaction(id: string) {
  if (!UUID.test(id)) throw new AppError("Transaction not found.", { code: "CASH_TRANSACTION_NOT_FOUND", status: 404 });
  const row = await db.orm.public.CashTransaction.where({ id }).first();
  if (!row) throw new AppError("Transaction not found.", { code: "CASH_TRANSACTION_NOT_FOUND", status: 404 });
  const accounts = await db.orm.public.LedgerAccount.where((account) => account.id.in([row.cashAccountId, row.counterAccountId])).all();
  const name = (accountId: string) => { const account = accounts.find((item) => item.id === accountId); return account ? `${account.code} ${account.name}` : null; };
  return { ...row, amount: fromCents(cents(String(row.amount))), cashAccountName: name(row.cashAccountId), counterAccountName: name(row.counterAccountId) };
}

export async function listCashTransactions(filters: { kind: string; from: string; to: string; search: string; page: number; pageSize: number }) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select t.id::text as id, t."transactionNumber", t.kind, t."transactionDate", t.amount::text as amount, coalesce(t.payee, '') as payee, coalesce(t.reference, '') as reference,
      t.description, t.status, ca.code || ' ' || ca.name as "cashAccountName", co.code || ' ' || co.name as "counterAccountName", coalesce(t."journalEntryId"::text, '') as "journalEntryId"
    from erp_cash_transactions t join erp_ledger_accounts ca on ca.id = t."cashAccountId" join erp_ledger_accounts co on co.id = t."counterAccountId"
    where (${filters.kind} = '' or t.kind = ${filters.kind})
      and (${filters.from} = '' or t."transactionDate" >= ${filters.from}) and (${filters.to} = '' or t."transactionDate" <= ${filters.to})
      and (${filters.search} = '' or t."transactionNumber" ilike ${pattern} or t.description ilike ${pattern} or t.payee ilike ${pattern} or t.reference ilike ${pattern})
    order by t."transactionDate" desc, t."transactionNumber" desc
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", transactionNumber: "pg/text@1", kind: "pg/text@1", transactionDate: "pg/text@1", amount: "pg/text@1", payee: "pg/text@1", reference: "pg/text@1", description: "pg/text@1", status: "pg/text@1", cashAccountName: "pg/text@1", counterAccountName: "pg/text@1", journalEntryId: "pg/text@1" }).build());
  return {
    transactions: result.slice(0, filters.pageSize).map((row) => ({ ...row, amount: fromCents(cents(row.amount)) })),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* Statements                                                          */
/* ------------------------------------------------------------------ */

const sum = (values: string[]) => fromCents(values.reduce((total, value) => total + cents(value), 0n));

export async function getTrialBalance(asOf = today()) {
  const accounts = (await balances(asOf)).map(shape).filter((row) => cents(row.debit) !== 0n || cents(row.credit) !== 0n);
  // Each account shows its net on the side it falls.
  const rowsOut = accounts.map((row) => {
    const net = cents(row.debit) - cents(row.credit);
    return { ...row, netDebit: net > 0n ? fromCents(net) : "0.00", netCredit: net < 0n ? fromCents(-net) : "0.00" };
  });
  const totalDebit = sum(rowsOut.map((row) => row.netDebit));
  const totalCredit = sum(rowsOut.map((row) => row.netCredit));
  return { asOf, accounts: rowsOut, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export async function getProfitAndLoss(from: string, to: string) {
  const accounts = (await balances(to, from)).map(shape).filter((row) => ["INCOME", "EXPENSE"].includes(row.accountType) && cents(row.balance) !== 0n);
  const income = accounts.filter((row) => row.accountType === "INCOME");
  const expenses = accounts.filter((row) => row.accountType === "EXPENSE");
  const totalIncome = sum(income.map((row) => row.balance));
  const totalExpenses = sum(expenses.map((row) => row.balance));
  return { from, to, income, expenses, totalIncome, totalExpenses, netProfit: fromCents(cents(totalIncome) - cents(totalExpenses)) };
}

export async function getBalanceSheet(asOf = today()) {
  const accounts = (await balances(asOf)).map(shape);
  const pick = (type: string) => accounts.filter((row) => row.accountType === type && cents(row.balance) !== 0n);
  const assets = pick("ASSET");
  const liabilities = pick("LIABILITY");
  const equity = pick("EQUITY");
  // Income less expenses to date, not yet closed to retained earnings.
  const earnings = fromCents(accounts.filter((row) => row.accountType === "INCOME").reduce((total, row) => total + cents(row.balance), 0n)
    - accounts.filter((row) => row.accountType === "EXPENSE").reduce((total, row) => total + cents(row.balance), 0n));
  const totalAssets = sum(assets.map((row) => row.balance));
  const totalLiabilities = sum(liabilities.map((row) => row.balance));
  const totalEquity = fromCents(cents(sum(equity.map((row) => row.balance))) + cents(earnings));
  return {
    asOf, assets, liabilities, equity, currentEarnings: earnings,
    totalAssets, totalLiabilities, totalEquity,
    totalLiabilitiesAndEquity: fromCents(cents(totalLiabilities) + cents(totalEquity)),
    balanced: cents(totalAssets) === cents(totalLiabilities) + cents(totalEquity),
  };
}

export async function getLedgerSummary(asOf = today()) {
  const accounts = await listAccounts(asOf);
  const cashBank = accounts.filter((row) => row.isCashBank);
  const monthStart = `${asOf.slice(0, 8)}01`;
  const pnl = await getProfitAndLoss(monthStart, asOf);
  return {
    asOf,
    cashBank: cashBank.map((row) => ({ id: row.id, code: row.code, name: row.name, balance: row.balance, status: row.status })),
    cashBankTotal: sum(cashBank.map((row) => row.balance)),
    monthIncome: pnl.totalIncome, monthExpenses: pnl.totalExpenses, monthNetProfit: pnl.netProfit,
  };
}
