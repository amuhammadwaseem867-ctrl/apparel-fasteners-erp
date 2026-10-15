import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import {
  createAccount,
  getAccountLedger,
  getBalanceSheet,
  getProfitAndLoss,
  getTrialBalance,
  listAccounts,
  postEntry,
  postManualJournal,
  recordCashTransaction,
  reverseManualJournal,
  updateAccount,
  voidCashTransaction,
} from "../../server/ledger/ledger.service.ts";
import { postMissingDocuments } from "../../server/ledger/postings.ts";
import { changeBill, createBill, recordSupplierPayment, voidSupplierPayment } from "../../server/procurement/payables.service.ts";
import { createSupplier } from "../../server/procurement/procurement.service.ts";
import { billInputSchema, supplierInputSchema, supplierPaymentInputSchema } from "../../server/procurement/procurement.validation.ts";

const run = Date.now().toString(36).toUpperCase().slice(-6);
const actor = randomUUID();
const key = () => randomUUID();
const ctx = {};

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

async function entriesFor(sourceType, sourceId) {
  const entries = await db.orm.public.JournalEntry.where({ sourceType, sourceId }).all();
  const lines = entries.length ? await db.orm.public.JournalLine.where((line) => line.entryId.in(entries.map((entry) => entry.id))).all() : [];
  return { entries, lines };
}

const accountId = async (systemKey) => (await db.orm.public.LedgerAccount.where({ systemKey }).first()).id;
const net = (lines, id) => lines.filter((line) => line.accountId === id).reduce((sum, line) => sum + Math.round(Number(line.debit) * 100) - Math.round(Number(line.credit) * 100), 0) / 100;

test.before(async () => {
  await listAccounts(); // creates the system accounts on first use
  ctx.bank = await accountId("BANK");
  ctx.cash = await accountId("CASH");
  ctx.ap = await accountId("AP");
  ctx.rent = await createAccount({ code: `6${run}`.slice(0, 12), name: `Factory rent ${run}`, accountType: "EXPENSE", isCashBank: false }, actor);
  ctx.bank2 = await createAccount({ code: `1${run}`.slice(0, 12), name: `Second bank ${run}`, accountType: "ASSET", isCashBank: true }, actor);
});

test("chart of accounts: system accounts exist once, codes are unique, system accounts stay active", async () => {
  const accounts = await listAccounts();
  for (const keyName of ["CASH", "BANK", "AR", "AP", "SALES", "OUTPUT_TAX", "INPUT_TAX", "PURCHASES", "SALARIES", "STAFF_ADVANCES"]) {
    assert.equal(accounts.filter((row) => row.systemKey === keyName).length, 1, keyName);
  }
  await expectCode(createAccount({ code: ctx.rent.code, name: "dup", accountType: "EXPENSE", isCashBank: false }, actor), "ACCOUNT_EXISTS");
  await expectCode(createAccount({ code: `X${run}`, name: "bad", accountType: "INCOME", isCashBank: true }, actor), "ACCOUNT_TYPE_INVALID");
  await expectCode(updateAccount(ctx.bank, { name: "Bank", status: "INACTIVE" }, actor), "ACCOUNT_SYSTEM");
});

test("manual journals: must balance, replay by key, reverse once, automatic entries are not reversed by hand", async () => {
  await expectCode(postManualJournal({ entryDate: "2031-03-01", description: "Unbalanced", idempotencyKey: key(), lines: [{ accountId: ctx.bank, debit: 100, credit: 0 }, { accountId: await accountId("OWNER_EQUITY"), debit: 0, credit: 99.99 }] }, actor), "JOURNAL_UNBALANCED");
  const journalKey = key();
  const opening = { entryDate: "2031-03-01", description: `Opening capital ${run}`, idempotencyKey: journalKey, lines: [{ accountId: ctx.bank, debit: 500000, credit: 0 }, { accountId: await accountId("OWNER_EQUITY"), debit: 0, credit: 500000 }] };
  const [first, replay] = await Promise.all([postManualJournal(opening, actor), postManualJournal(opening, actor)]);
  assert.equal(first.id, replay.id, "same key, same entry");
  assert.equal(first.totalAmount, "500000.00");

  const reversal = await reverseManualJournal(first.id, "2031-03-02", "entered twice", actor);
  assert.deepEqual(reversal.lines.map((line) => [line.debit, line.credit]), [["0.00", "500000.00"], ["500000.00", "0.00"]]);
  await expectCode(reverseManualJournal(first.id, "2031-03-02", "again", actor), "JOURNAL_ALREADY_REVERSED");
  await expectCode(reverseManualJournal(reversal.id, "2031-03-02", "undo", actor), "JOURNAL_IS_REVERSAL");
  ctx.capital = await postManualJournal({ ...opening, idempotencyKey: key() }, actor);
});

test("automatic postings are idempotent per source event, even concurrently", async () => {
  const source = { type: "TestDocument", id: randomUUID(), event: "POSTED" };
  const post = () => db.transaction((tx) => postEntry(tx, { date: "2031-03-03", description: "test", source, lines: [{ account: "CASH", debit: "1.00" }, { account: "OTHER_INCOME", credit: "1.00" }] }, actor));
  const ids = await Promise.all([post(), post(), post()]);
  assert.equal(new Set(ids).size, 1);
  assert.equal((await entriesFor(source.type, source.id)).entries.length, 1);
  const auto = await db.orm.public.JournalEntry.where({ id: ids[0] }).first();
  await expectCode(reverseManualJournal(auto.id, "2031-03-03", "nope", actor), "JOURNAL_AUTOMATIC");
});

test("expenses, income and transfers post to the ledger; voids reverse them; P&L for the period is exact", async () => {
  const otherIncome = async () => (await getProfitAndLoss("2031-03-01", "2031-03-31")).income.find((row) => row.systemKey === "OTHER_INCOME")?.balance ?? "0.00";
  const incomeBefore = await otherIncome();
  const rent = await recordCashTransaction({ kind: "EXPENSE", transactionDate: "2031-03-05", cashAccountId: ctx.bank, counterAccountId: ctx.rent.id, amount: 1234.56, payee: "Landlord", description: "March rent", idempotencyKey: key() }, actor);
  await recordCashTransaction({ kind: "INCOME", transactionDate: "2031-03-06", cashAccountId: ctx.cash, counterAccountId: await accountId("OTHER_INCOME"), amount: 0.1, description: "Scrap sale", idempotencyKey: key() }, actor);
  await recordCashTransaction({ kind: "INCOME", transactionDate: "2031-03-06", cashAccountId: ctx.cash, counterAccountId: await accountId("OTHER_INCOME"), amount: 0.2, description: "Scrap sale", idempotencyKey: key() }, actor);
  const transfer = await recordCashTransaction({ kind: "TRANSFER", transactionDate: "2031-03-07", cashAccountId: ctx.bank, counterAccountId: ctx.bank2.id, amount: 1000, description: "Move funds", idempotencyKey: key() }, actor);
  await expectCode(recordCashTransaction({ kind: "INCOME", transactionDate: "2031-03-07", cashAccountId: ctx.bank, counterAccountId: ctx.rent.id, amount: 5, description: "wrong", idempotencyKey: key() }, actor), "COUNTER_ACCOUNT_INVALID");
  await expectCode(recordCashTransaction({ kind: "TRANSFER", transactionDate: "2031-03-07", cashAccountId: ctx.bank, counterAccountId: ctx.rent.id, amount: 5, description: "wrong", idempotencyKey: key() }, actor), "COUNTER_ACCOUNT_INVALID");

  const statement = await getAccountLedger(ctx.bank2.id, "2031-03-01", "2031-03-31");
  assert.equal(statement.closingBalance, "1000.00");
  await voidCashTransaction(transfer.id, "wrong account", actor);
  await expectCode(voidCashTransaction(transfer.id, "again", actor), "CASH_TRANSACTION_VOIDED");
  assert.equal((await getAccountLedger(ctx.bank2.id, "2031-03-01", "2031-03-31")).closingBalance, "0.00");

  const pnl = await getProfitAndLoss("2031-03-01", "2031-03-31");
  const rentRow = pnl.expenses.find((row) => row.id === ctx.rent.id);
  assert.equal(rentRow.balance, "1234.56");
  const incomeAfter = pnl.income.find((row) => row.systemKey === "OTHER_INCOME").balance;
  assert.equal(Math.round(Number(incomeAfter) * 100) - Math.round(Number(incomeBefore) * 100), 30, "0.1 + 0.2 is exactly 0.30");
  assert.match(incomeAfter, /^\d+\.\d{2}$/);
  assert.equal(rent.cashAccountName.startsWith("1010"), true);
});

test("supplier bill, payment, void and cancel move AP and bank and leave nothing behind", async () => {
  const supplier = await createSupplier(supplierInputSchema.parse({ code: `L-${run}`, name: `Ledger supplier ${run}` }), actor);
  const bill = await createBill(billInputSchema.parse({ idempotencyKey: key(), supplierId: supplier.id, supplierInvoiceNumber: `LI-${run}`, billDate: "2031-03-10", lines: [{ description: "Machine repair", quantity: 1, unitPrice: 1000, taxPercent: 16 }] }), actor);
  await changeBill(bill.id, "approve", "", actor);
  let posted = await entriesFor("SupplierBill", bill.id);
  assert.equal(net(posted.lines, ctx.ap), -1160, "AP credited with the bill total");
  assert.equal(net(posted.lines, await accountId("INPUT_TAX")), 160);
  assert.equal(net(posted.lines, await accountId("GENERAL_EXPENSES")), 1000, "non-PO lines are expenses");

  const payment = await recordSupplierPayment(supplierPaymentInputSchema.parse({ idempotencyKey: key(), billId: bill.id, paymentDate: "2031-03-11", method: "CASH", amount: 1160 }), actor);
  const paid = await entriesFor("SupplierPayment", payment.id);
  assert.equal(net(paid.lines, ctx.ap), 1160);
  assert.equal(net(paid.lines, ctx.cash), -1160, "method CASH pays from cash in hand");

  await voidSupplierPayment(payment.id, "wrong method", actor);
  await changeBill(bill.id, "cancel", "duplicate invoice", actor);
  posted = await entriesFor("SupplierBill", bill.id);
  const voided = await entriesFor("SupplierPayment", payment.id);
  assert.equal(posted.entries.length, 2, "approval and its reversal");
  assert.equal(net([...posted.lines, ...voided.lines], ctx.ap), 0);
  assert.equal(net([...posted.lines, ...voided.lines], ctx.cash), 0);
});

test("backfill posts every earlier document once; afterwards nothing is missing", async () => {
  await postMissingDocuments(actor);
  const [missing] = await db.runtime().query(db.raw.sql`
    select
      (select count(*) from erp_invoices d where d.status = 'ISSUED' and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'Invoice' and j."sourceId" = d.id))::text as invoices,
      (select count(*) from erp_customer_receipts d where not exists (select 1 from erp_journal_entries j where j."sourceType" = 'CustomerReceipt' and j."sourceId" = d.id))::text as receipts,
      (select count(*) from erp_credit_notes d where not exists (select 1 from erp_journal_entries j where j."sourceType" = 'CreditNote' and j."sourceId" = d.id))::text as credits,
      (select count(*) from erp_payroll_runs d where d.status in ('APPROVED', 'PAID') and d."grossTotal" > 0 and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'PayrollRun' and j."sourceId" = d.id))::text as payroll
  `.returnsRow({ invoices: "pg/text@1", receipts: "pg/text@1", credits: "pg/text@1", payroll: "pg/text@1" }).build());
  assert.deepEqual({ ...missing }, { invoices: "0", receipts: "0", credits: "0", payroll: "0" });
  assert.deepEqual(await postMissingDocuments(actor), {}, "a second run posts nothing");
});

test("the whole ledger balances: trial balance and balance sheet", async () => {
  const trial = await getTrialBalance("2099-12-31");
  assert.equal(trial.balanced, true, `${trial.totalDebit} vs ${trial.totalCredit}`);
  const sheet = await getBalanceSheet("2099-12-31");
  assert.equal(sheet.balanced, true, `${sheet.totalAssets} vs ${sheet.totalLiabilitiesAndEquity}`);
  const [unbalanced] = await db.runtime().query(db.raw.sql`
    select count(*)::text as count from (select "entryId" from erp_journal_lines group by "entryId" having sum(debit) <> sum(credit)) bad
  `.returnsRow({ count: "pg/text@1" }).build());
  assert.equal(unbalanced.count, "0", "every entry balances on its own");
});
