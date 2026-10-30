/*
 * D-052: one customer's account: old balance, invoices, installments on
 * account or per invoice, the ledger with its running balance, and the
 * receivables that agree with it.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { getCustomerAccount, getCustomerLedger, setOpeningBalance } from "../../server/finance/customer-account.service.ts";
import { customerBalances } from "../../server/finance/customer-ledger.ts";
import { changeInvoice, createManualInvoice, getReceivables, recordReceipt, voidReceipt } from "../../server/finance/finance.service.ts";
import { manualInvoiceSchema, openingBalanceSchema, receiptInputSchema } from "../../server/finance/finance.validation.ts";
import { createCustomer } from "../../server/sales/sales.service.ts";

const run = `CA${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};

const receipt = (input) => recordReceipt(receiptInputSchema.parse({ idempotencyKey: randomUUID(), method: "BANK_TRANSFER", ...input }), actor);
const opening = (amount, date = "2026-01-01") => setOpeningBalance(ctx.customer.id, openingBalanceSchema.parse({ amount, date }), actor);
const arPosted = async () => {
  const [row] = await db.runtime().query(db.raw.sql`
    select coalesce(sum(l.debit - l.credit), 0)::text as total from erp_journal_lines l
    join erp_journal_entries e on e.id = l."entryId" join erp_ledger_accounts a on a.id = l."accountId"
    where a."systemKey" = 'AR' and e."sourceType" = 'CustomerOpening' and e."sourceId" = ${ctx.customer.id}::uuid
  `.returnsRow({ total: "pg/text@1" }).build());
  return Number(row.total);
};

test.before(async () => {
  ctx.customer = await createCustomer({ code: `CA-${run}`, name: `Account ${run}` }, actor);
  ctx.other = await createCustomer({ code: `CB-${run}`, name: `Other ${run}` }, actor);
  const created = await createManualInvoice(manualInvoiceSchema.parse({
    idempotencyKey: randomUUID(), paymentTermsDays: 30, invoiceType: "NON_TAX",
    sheet: { customerId: ctx.customer.id, orderDate: "2026-10-01", lines: [{ product: "#5 Metal Zipper", size: "20 Inch", unit: "Pcs", quantity: 1000, unitPrice: 50 }] },
  }), actor);
  ctx.invoice = await changeInvoice(created.id, "issue", "", actor);
});

test("the old balance opens the ledger and is posted to the general ledger by its change", async () => {
  await opening(20000);
  assert.equal(await arPosted(), 20000);
  await opening(15000);
  assert.equal(await arPosted(), 15000, "lowering it posts the difference back");
  const account = await getCustomerAccount(ctx.customer.id);
  assert.equal(account.summary.openingBalance, "15000.00");
  assert.equal(account.summary.balance, "65000.00", "old 15,000 + invoice 50,000");
});

test("installments on account and on the invoice are credits; the running balance adds up", async () => {
  const first = await receipt({ customerId: ctx.customer.id, receiptDate: "2026-10-05", amount: 10000, reference: "CHQ-1" });
  assert.equal(first.invoiceId, null);
  assert.equal(first.invoiceNumber, null);
  await receipt({ invoiceId: ctx.invoice.id, receiptDate: "2026-10-10", amount: 20000 });
  await assert.rejects(receipt({ invoiceId: ctx.invoice.id, customerId: ctx.other.id, receiptDate: "2026-10-10", amount: 1 }), (error) => error.code === "RECEIPT_CUSTOMER_MISMATCH");
  assert.equal(receiptInputSchema.safeParse({ idempotencyKey: randomUUID(), method: "CASH", receiptDate: "2026-10-10", amount: 1 }).success, false, "needs an invoice or a customer");
  const voided = await receipt({ customerId: ctx.customer.id, receiptDate: "2026-10-12", amount: 999 });
  await voidReceipt(voided.id, "Entered twice", actor);

  const ledger = await getCustomerLedger(ctx.customer.id);
  assert.deepEqual(ledger.rows.map((row) => [row.kind, row.debit, row.credit, row.balance]), [
    ["OPENING", "15000.00", "0.00", "15000.00"],
    ["INVOICE", "50000.00", "0.00", "65000.00"],
    ["RECEIPT", "0.00", "10000.00", "55000.00"],
    ["RECEIPT", "0.00", "20000.00", "35000.00"],
  ]);
  assert.match(ledger.rows[2].particulars, /on account/);
  assert.match(ledger.rows[3].particulars, new RegExp(`for ${ctx.invoice.invoiceNumber}`));
  assert.deepEqual([ledger.totalDebit, ledger.totalCredit, ledger.balance], ["65000.00", "30000.00", "35000.00"]);

  // A period: everything before it is brought forward.
  const october = await getCustomerLedger(ctx.customer.id, { from: "2026-10-06", to: "2026-10-31" });
  assert.deepEqual(october.rows.map((row) => [row.particulars, row.balance]), [["Brought forward", "55000.00"], [october.rows[1].particulars, "35000.00"]]);

  assert.equal((await customerBalances([ctx.customer.id])).get(ctx.customer.id), "35000.00");
  const account = await getCustomerAccount(ctx.customer.id);
  assert.deepEqual([account.summary.received, account.summary.onAccount], ["30000.00", "10000.00"]);
  assert.equal(account.invoices[0].outstanding, "30000.00", "the invoice shows what was paid on it");
  assert.equal(account.orders.length, 1);
});

test("receivables count the old balance and settle payments on account oldest first", async () => {
  const receivables = await getReceivables("2026-11-30");
  const mine = receivables.customers.find((row) => row.customerId === ctx.customer.id);
  assert.equal(mine.total, "35000.00", "matches the ledger balance");
  // Old 15,000 is settled by 10,000 on account (5,000 left, 90+); the invoice has 30,000 left.
  assert.equal(mine.buckets["90+"], "5000.00");
});

test("the old khata's lines (D-057) are in the ledger in sheet order, the account and receivables", async () => {
  const old = await createCustomer({ code: `CK-${run}`, name: `Khata ${run}` }, actor);
  await db.runtime().query(db.raw.sql`
    insert into erp_customer_ledger_entries (id, "customerId", "lineNo", "entryDate", "dateMissing", reference, "poNumber", "dcNumber", description, debit, credit) values
      (gen_random_uuid(), ${old.id}::uuid, 1, '2025-01-10', false, 'AF-25-1', 'PO-7', null, 'Metal Zipper', 50000, 0),
      (gen_random_uuid(), ${old.id}::uuid, 2, '2025-02-01', false, null, null, null, 'Payment Received', 0, 20000),
      (gen_random_uuid(), ${old.id}::uuid, 3, '2025-02-01', true, null, null, null, 'Adjustment of withholding tax', 0, 1000)
    returning id
  `.returnsRow({ id: "pg/uuid@1" }).build());
  const ledger = await getCustomerLedger(old.id);
  assert.deepEqual(ledger.rows.map((row) => [row.kind, row.reference, row.balance]), [
    ["OLD", "AF-25-1", "50000.00"], ["OLD", "", "30000.00"], ["OLD", "", "29000.00"],
  ]);
  assert.equal(ledger.rows[0].particulars, "Metal Zipper · PO PO-7");
  assert.equal(ledger.rows[2].particulars, "Adjustment of withholding tax · date not in the sheet");
  const account = await getCustomerAccount(old.id);
  assert.deepEqual([account.summary.oldLines, account.summary.oldBalance, account.summary.balance], [3, "29000.00", "29000.00"]);
  const mine = (await getReceivables("2026-11-30")).customers.find((row) => row.customerId === old.id);
  assert.equal(mine.total, "29000.00", "old invoices are dues, old payments settle them");
});
