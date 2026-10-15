/*
 * Automatic ledger postings for documents in other modules (D-030). Each
 * function runs inside the document's own transaction, so the document
 * and its entry commit or fail together, and is idempotent per
 * (document, event).
 *
 * Invoice issued      Dr AR total / Cr Sales (net of discount), Cr Output tax
 * Credit note         the reverse of the above for the credited amounts
 * Customer receipt    Dr Cash (method CASH) or Bank / Cr AR; void reverses
 * Supplier bill       Dr Purchases (PO lines) or General expenses (other
 *   approved          lines), Dr Input tax / Cr AP; cancel reverses
 * Supplier payment    Dr AP / Cr Cash or Bank; void reverses
 * Salary advance      Dr Staff advances / Cr Cash; cancel reverses
 * Payroll approved    Dr Salaries (gross) / Cr Staff advances (recovered),
 *                     Cr Payroll deductions payable, Cr Salaries payable (net)
 * Payroll paid        Dr Salaries payable / Cr Bank
 */

import { db } from "../core/database/client";
import type { Tx } from "../inventory/inventory.service";
import { cents, fromCents, nonZero } from "./ledger-rules";
import { type PostingLine, postEntry, reverseSourcePosting } from "./ledger.service";

const today = () => new Date().toISOString().slice(0, 10);
const m = (value: unknown) => fromCents(cents(String(value ?? "0")));
const minus = (a: unknown, b: unknown) => fromCents(cents(String(a)) - cents(String(b)));
const cashKey = (method: string) => (method === "CASH" ? "CASH" : "BANK") as "CASH" | "BANK";

async function post(tx: Tx, date: string, description: string, source: { type: string; id: string; event: string }, lines: PostingLine[], actorId: string) {
  const kept = nonZero(lines.map((line) => ({ ...line, debit: line.debit ?? "0", credit: line.credit ?? "0" })));
  if (kept.length < 2) return null; // nothing of value to post
  return postEntry(tx, { date, description, source, lines: kept }, actorId);
}

export async function postInvoiceIssued(tx: Tx, invoiceId: string, actorId: string) {
  const invoice = (await tx.orm.public.Invoice.where({ id: invoiceId }).first())!;
  return post(tx, invoice.invoiceDate, `Invoice ${invoice.invoiceNumber}`, { type: "Invoice", id: invoiceId, event: "ISSUED" }, [
    { account: "AR", debit: m(invoice.totalAmount) },
    { account: "SALES", credit: minus(invoice.subtotal, invoice.discountTotal) },
    { account: "OUTPUT_TAX", credit: m(invoice.taxTotal) },
  ], actorId);
}

export async function postCreditNote(tx: Tx, creditNoteId: string, actorId: string) {
  const note = (await tx.orm.public.CreditNote.where({ id: creditNoteId }).first())!;
  return post(tx, note.creditDate, `Credit note ${note.creditNumber}`, { type: "CreditNote", id: creditNoteId, event: "POSTED" }, [
    { account: "SALES", debit: minus(note.subtotal, note.discountTotal) },
    { account: "OUTPUT_TAX", debit: m(note.taxTotal) },
    { account: "AR", credit: m(note.totalAmount) },
  ], actorId);
}

export async function postCustomerReceipt(tx: Tx, receiptId: string, actorId: string) {
  const receipt = (await tx.orm.public.CustomerReceipt.where({ id: receiptId }).first())!;
  return post(tx, receipt.receiptDate, `Receipt ${receipt.receiptNumber}`, { type: "CustomerReceipt", id: receiptId, event: "POSTED" }, [
    { account: cashKey(receipt.method), debit: m(receipt.amount), memo: receipt.reference },
    { account: "AR", credit: m(receipt.amount) },
  ], actorId);
}

export function reverseCustomerReceipt(tx: Tx, receiptId: string, reason: string, actorId: string, date = today()) {
  return reverseSourcePosting(tx, { type: "CustomerReceipt", id: receiptId, event: "POSTED" }, "VOIDED", `Receipt voided: ${reason}`, actorId, date);
}

export async function postSupplierBillApproved(tx: Tx, billId: string, actorId: string) {
  const bill = (await tx.orm.public.SupplierBill.where({ id: billId }).first())!;
  const lines = await tx.orm.public.SupplierBillLine.where({ billId }).all();
  const net = (filter: (line: (typeof lines)[number]) => boolean) =>
    fromCents(lines.filter(filter).reduce((total, line) => total + cents(String(line.grossAmount)) - cents(String(line.discountAmount)), 0n));
  return post(tx, bill.billDate, `Supplier bill ${bill.billNumber} (invoice ${bill.supplierInvoiceNumber})`, { type: "SupplierBill", id: billId, event: "APPROVED" }, [
    { account: "PURCHASES", debit: net((line) => Boolean(line.purchaseOrderLineId)) },
    { account: "GENERAL_EXPENSES", debit: net((line) => !line.purchaseOrderLineId) },
    { account: "INPUT_TAX", debit: m(bill.taxTotal) },
    { account: "AP", credit: m(bill.totalAmount) },
  ], actorId);
}

export function reverseSupplierBill(tx: Tx, billId: string, reason: string, actorId: string, date = today()) {
  return reverseSourcePosting(tx, { type: "SupplierBill", id: billId, event: "APPROVED" }, "CANCELLED", `Supplier bill cancelled: ${reason}`, actorId, date);
}

export async function postSupplierPayment(tx: Tx, paymentId: string, actorId: string) {
  const payment = (await tx.orm.public.SupplierPayment.where({ id: paymentId }).first())!;
  return post(tx, payment.paymentDate, `Supplier payment ${payment.paymentNumber}`, { type: "SupplierPayment", id: paymentId, event: "POSTED" }, [
    { account: "AP", debit: m(payment.amount) },
    { account: cashKey(payment.method), credit: m(payment.amount), memo: payment.reference },
  ], actorId);
}

export function reverseSupplierPayment(tx: Tx, paymentId: string, reason: string, actorId: string, date = today()) {
  return reverseSourcePosting(tx, { type: "SupplierPayment", id: paymentId, event: "POSTED" }, "VOIDED", `Supplier payment voided: ${reason}`, actorId, date);
}

export async function postSalaryAdvance(tx: Tx, advanceId: string, actorId: string) {
  const advance = (await tx.orm.public.SalaryAdvance.where({ id: advanceId }).first())!;
  return post(tx, advance.issueDate, `Salary advance ${advance.advanceNumber}`, { type: "SalaryAdvance", id: advanceId, event: "ISSUED" }, [
    { account: "STAFF_ADVANCES", debit: m(advance.amount) },
    { account: "CASH", credit: m(advance.amount) },
  ], actorId);
}

export function reverseSalaryAdvance(tx: Tx, advanceId: string, actorId: string, date = today()) {
  return reverseSourcePosting(tx, { type: "SalaryAdvance", id: advanceId, event: "ISSUED" }, "CANCELLED", "Salary advance cancelled", actorId, date);
}

function periodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export async function postPayrollApproved(tx: Tx, runId: string, actorId: string) {
  const run = (await tx.orm.public.PayrollRun.where({ id: runId }).first())!;
  const lines = await tx.orm.public.PayrollLine.where({ runId }).all();
  const total = (field: "grossPay" | "advanceRecovery" | "fixedDeduction" | "otherDeduction" | "netPay") => fromCents(lines.reduce((value, line) => value + cents(String(line[field])), 0n));
  return post(tx, periodEnd(run.period), `Payroll ${run.runNumber} (${run.period})`, { type: "PayrollRun", id: runId, event: "APPROVED" }, [
    { account: "SALARIES", debit: total("grossPay") },
    { account: "STAFF_ADVANCES", credit: total("advanceRecovery") },
    { account: "PAYROLL_DEDUCTIONS", credit: fromCents(cents(total("fixedDeduction")) + cents(total("otherDeduction"))) },
    { account: "SALARIES_PAYABLE", credit: total("netPay") },
  ], actorId);
}

export async function postPayrollPaid(tx: Tx, runId: string, actorId: string, date = today()) {
  const run = (await tx.orm.public.PayrollRun.where({ id: runId }).first())!;
  return post(tx, date, `Payroll ${run.runNumber} paid`, { type: "PayrollRun", id: runId, event: "PAID" }, [
    { account: "SALARIES_PAYABLE", debit: m(run.netTotal) },
    { account: "BANK", credit: m(run.netTotal), memo: run.paymentReference },
  ], actorId);
}

/*
 * Posts every document recorded before the ledger existed (or while a
 * posting failed), with the document's own dates. Safe to run again:
 * postings are idempotent per document event.
 */
export async function postMissingDocuments(actorId: string) {
  const counts: Record<string, number> = {};
  const runEach = async (label: string, ids: string[], work: (tx: Tx, id: string) => Promise<unknown>) => {
    for (const id of ids) {
      const posted = await db.transaction(async (tx) => work(tx, id));
      if (posted) counts[label] = (counts[label] ?? 0) + 1;
    }
  };
  const missing = async (sql: ReturnType<typeof db.raw.sql>) => ((await db.runtime().query(sql.returnsRow({ id: "pg/text@1" }).build() as never)) as unknown as Array<{ id: string }>).map((row) => row.id);

  await runEach("invoices", await missing(db.raw.sql`select d.id::text as id from erp_invoices d where d.status = 'ISSUED' and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'Invoice' and j."sourceId" = d.id) order by d."invoiceDate"`), (tx, id) => postInvoiceIssued(tx, id, actorId));
  await runEach("creditNotes", await missing(db.raw.sql`select d.id::text as id from erp_credit_notes d where not exists (select 1 from erp_journal_entries j where j."sourceType" = 'CreditNote' and j."sourceId" = d.id) order by d."creditDate"`), (tx, id) => postCreditNote(tx, id, actorId));
  await runEach("receipts", await missing(db.raw.sql`select d.id::text as id from erp_customer_receipts d where not exists (select 1 from erp_journal_entries j where j."sourceType" = 'CustomerReceipt' and j."sourceId" = d.id and j."sourceEvent" = 'POSTED') order by d."receiptDate"`), (tx, id) => postCustomerReceipt(tx, id, actorId));
  await runEach("receiptVoids", await missing(db.raw.sql`select d.id::text as id from erp_customer_receipts d where d.status = 'VOIDED' and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'CustomerReceipt' and j."sourceId" = d.id and j."sourceEvent" = 'VOIDED')`), async (tx, id) => {
    const row = (await tx.orm.public.CustomerReceipt.where({ id }).first())!;
    return reverseCustomerReceipt(tx, id, row.voidReason ?? "voided", actorId, String(row.voidedAt ?? "").slice(0, 10) || today());
  });
  await runEach("supplierBills", await missing(db.raw.sql`select d.id::text as id from erp_supplier_bills d where d."approvedAt" is not null and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'SupplierBill' and j."sourceId" = d.id and j."sourceEvent" = 'APPROVED') order by d."billDate"`), (tx, id) => postSupplierBillApproved(tx, id, actorId));
  await runEach("supplierBillCancels", await missing(db.raw.sql`select d.id::text as id from erp_supplier_bills d where d.status = 'CANCELLED' and d."approvedAt" is not null and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'SupplierBill' and j."sourceId" = d.id and j."sourceEvent" = 'CANCELLED')`), async (tx, id) => {
    const row = (await tx.orm.public.SupplierBill.where({ id }).first())!;
    return reverseSupplierBill(tx, id, row.cancelReason ?? "cancelled", actorId, String(row.cancelledAt ?? "").slice(0, 10) || today());
  });
  await runEach("supplierPayments", await missing(db.raw.sql`select d.id::text as id from erp_supplier_payments d where not exists (select 1 from erp_journal_entries j where j."sourceType" = 'SupplierPayment' and j."sourceId" = d.id and j."sourceEvent" = 'POSTED') order by d."paymentDate"`), (tx, id) => postSupplierPayment(tx, id, actorId));
  await runEach("supplierPaymentVoids", await missing(db.raw.sql`select d.id::text as id from erp_supplier_payments d where d.status = 'VOIDED' and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'SupplierPayment' and j."sourceId" = d.id and j."sourceEvent" = 'VOIDED')`), async (tx, id) => {
    const row = (await tx.orm.public.SupplierPayment.where({ id }).first())!;
    return reverseSupplierPayment(tx, id, row.voidReason ?? "voided", actorId, String(row.voidedAt ?? "").slice(0, 10) || today());
  });
  await runEach("salaryAdvances", await missing(db.raw.sql`select d.id::text as id from erp_salary_advances d where not exists (select 1 from erp_journal_entries j where j."sourceType" = 'SalaryAdvance' and j."sourceId" = d.id and j."sourceEvent" = 'ISSUED') order by d."issueDate"`), (tx, id) => postSalaryAdvance(tx, id, actorId));
  await runEach("salaryAdvanceCancels", await missing(db.raw.sql`select d.id::text as id from erp_salary_advances d where d.status = 'CANCELLED' and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'SalaryAdvance' and j."sourceId" = d.id and j."sourceEvent" = 'CANCELLED')`), async (tx, id) => {
    const row = (await tx.orm.public.SalaryAdvance.where({ id }).first())!;
    return reverseSalaryAdvance(tx, id, actorId, String(row.cancelledAt ?? "").slice(0, 10) || today());
  });
  await runEach("payrollRuns", await missing(db.raw.sql`select d.id::text as id from erp_payroll_runs d where d.status in ('APPROVED', 'PAID') and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'PayrollRun' and j."sourceId" = d.id and j."sourceEvent" = 'APPROVED') order by d.period`), (tx, id) => postPayrollApproved(tx, id, actorId));
  await runEach("payrollPayments", await missing(db.raw.sql`select d.id::text as id from erp_payroll_runs d where d.status = 'PAID' and not exists (select 1 from erp_journal_entries j where j."sourceType" = 'PayrollRun' and j."sourceId" = d.id and j."sourceEvent" = 'PAID') order by d.period`), async (tx, id) => {
    const row = (await tx.orm.public.PayrollRun.where({ id }).first())!;
    return postPayrollPaid(tx, id, actorId, String(row.paidAt ?? "").slice(0, 10) || today());
  });
  return counts;
}
