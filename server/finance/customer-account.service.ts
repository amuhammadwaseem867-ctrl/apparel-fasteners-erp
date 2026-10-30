/*
 * One customer's account (D-052): their orders, invoices, payments and
 * ledger (khata) in one place, so tracking, history and installments are
 * easy. The ledger starts with the old balance from before the ERP, then
 * issued invoices (debit), credit notes and payments (credit), with a
 * running balance. Payments can pay one invoice or come on account.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import type { Tx } from "../inventory/inventory.service";
import { postEntry } from "../ledger/ledger.service";
import { listSalesOrders } from "../sales/sales.service";
import { cash, runningLedgerFor } from "./customer-ledger";
import { addMoney, compareMoney, money, subtractMoney, outstandingAmount, paymentStatus } from "./finance-rules";
import type { LedgerQuery, OpeningBalanceInput } from "./finance.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rows<T>(runner: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await runner.query(plan as never)) as unknown as T[];
}

function customerNotFound(): never {
  throw new AppError("Customer not found.", { code: "CUSTOMER_NOT_FOUND", status: 404 });
}

async function findCustomer(id: string) {
  if (!UUID.test(id)) customerNotFound();
  const customer = await db.orm.public.Customer.where({ id }).first();
  if (!customer) customerNotFound();
  return customer;
}

export async function getCustomerLedger(customerId: string, query: LedgerQuery = {}) {
  const customer = await findCustomer(customerId);
  const ledger = await runningLedgerFor(db.runtime(), customerId, query.from || "", query.to || "");
  return {
    customer: { id: customer.id, code: customer.code, name: customer.name, address: customer.address, phone: customer.phone, contactPerson: customer.contactPerson, ntn: customer.ntn },
    from: query.from || "",
    to: query.to || "",
    ...ledger,
  };
}

/* Everything about one customer for the customer page. */
export async function getCustomerAccount(customerId: string) {
  const customer = await findCustomer(customerId);
  const runtime = db.runtime();
  const invoices = await rows<Record<string, string>>(runtime, db.raw.sql`
    select i.id::text as id, i."invoiceNumber", i."invoiceDate", i."dueDate", i.status, i."invoiceType",
      i."salesOrderId"::text as "salesOrderId", i."totalAmount"::text as total,
      coalesce((select sum("totalAmount") from erp_credit_notes cn where cn."invoiceId" = i.id), 0)::text as credited,
      coalesce((select sum(amount) from erp_customer_receipts r where r."invoiceId" = i.id and r.status = 'POSTED'), 0)::text as received
    from erp_invoices i
    where i."customerId" = ${customerId}::uuid
    order by i."invoiceDate" desc, i."createdAt" desc
  `.returnsRow({
    id: "pg/text@1", invoiceNumber: "pg/text@1", invoiceDate: "pg/text@1", dueDate: "pg/text@1", status: "pg/text@1", invoiceType: "pg/text@1",
    salesOrderId: "pg/text@1", total: "pg/text@1", credited: "pg/text@1", received: "pg/text@1",
  }).build());
  const receipts = await rows<Record<string, string>>(runtime, db.raw.sql`
    select r.id::text as id, r."receiptNumber", r."receiptDate", r.method, coalesce(r.reference, '') as reference, r.amount::text as amount,
      r.status, coalesce(r.notes, '') as notes, coalesce(i.id::text, '') as "invoiceId", coalesce(i."invoiceNumber", '') as "invoiceNumber"
    from erp_customer_receipts r
    left join erp_invoices i on i.id = r."invoiceId"
    where r."customerId" = ${customerId}::uuid
    order by r."receiptDate" desc, r."createdAt" desc
  `.returnsRow({
    id: "pg/text@1", receiptNumber: "pg/text@1", receiptDate: "pg/text@1", method: "pg/text@1", reference: "pg/text@1", amount: "pg/text@1",
    status: "pg/text@1", notes: "pg/text@1", invoiceId: "pg/text@1", invoiceNumber: "pg/text@1",
  }).build());
  const [old] = await rows<{ lines: string; debit: string; credit: string }>(runtime, db.raw.sql`
    select count(*)::text as lines, coalesce(sum(debit), 0)::text as debit, coalesce(sum(credit), 0)::text as credit
    from erp_customer_ledger_entries where "customerId" = ${customerId}::uuid
  `.returnsRow({ lines: "pg/text@1", debit: "pg/text@1", credit: "pg/text@1" }).build());
  const orders = await listSalesOrders({ customerId, page: 1, pageSize: 100 } as never);
  const ledger = await runningLedgerFor(runtime, customerId, "", "");
  const issued = invoices.filter((row) => row.status === "ISSUED");
  const posted = receipts.filter((row) => row.status === "POSTED");
  const sum = (values: string[]) => values.reduce((total, value) => addMoney(total, value), "0.00");

  return {
    customer: { ...customer, openingBalance: cash(customer.openingBalance) },
    summary: {
      openingBalance: cash(customer.openingBalance),
      // The old khata (D-057): its lines and what it left owing.
      oldLines: Number(old.lines),
      oldBalance: subtractMoney(addMoney(cash(customer.openingBalance), cash(old.debit)), cash(old.credit)),
      invoiced: sum(issued.map((row) => row.total)),
      credited: sum(issued.map((row) => row.credited)),
      received: sum(posted.map((row) => row.amount)),
      onAccount: sum(posted.filter((row) => !row.invoiceId).map((row) => row.amount)),
      balance: ledger.balance,
    },
    orders: orders.orders,
    ordersHasMore: orders.hasMore,
    invoices: invoices.map((row) => {
      const total = cash(row.total);
      const credited = cash(row.credited);
      const received = cash(row.received);
      return {
        ...row, total, credited, received,
        outstanding: row.status === "ISSUED" ? outstandingAmount(total, credited, received) : "0.00",
        paymentStatus: row.status === "ISSUED" ? paymentStatus(total, credited, received) : null,
      };
    }),
    receipts: receipts.map((row) => ({ ...row, amount: cash(row.amount) })),
    ledger,
  };
}

/*
 * Sets the old balance and its date. The general ledger gets the change
 * (Dr Accounts receivable / Cr Owner's equity and opening balances, or the
 * reverse when lowered), one entry per change, so it always matches.
 */
export async function setOpeningBalance(customerId: string, input: OpeningBalanceInput, actorId: string) {
  await findCustomer(customerId);
  const amount = money(String(input.amount));
  await db.transaction(async (tx) => {
    const [locked] = await rows<{ amount: string }>(tx, db.raw.sql`
      select "openingBalance"::text as amount from erp_customers where id = ${customerId}::uuid for update
    `.returnsRow({ amount: "pg/text@1" }).build());
    const previous = cash(locked.amount);
    await tx.orm.public.Customer.where({ id: customerId }).update({ openingBalance: amount, openingBalanceDate: input.date, updatedAt: new Date().toISOString() });
    const change = compareMoney(amount, previous);
    if (change !== 0) {
      const [count] = await rows<{ count: string }>(tx, db.raw.sql`
        select count(*)::text as count from erp_journal_entries where "sourceType" = 'CustomerOpening' and "sourceId" = ${customerId}::uuid
      `.returnsRow({ count: "pg/text@1" }).build());
      const value = change > 0 ? subtractMoney(amount, previous) : subtractMoney(previous, amount);
      await postEntry(tx, {
        date: input.date,
        description: `Customer old balance ${change > 0 ? "set" : "lowered"} (${previous} to ${amount})`,
        source: { type: "CustomerOpening", id: customerId, event: `CHANGE-${Number(count.count) + 1}` },
        lines: change > 0
          ? [{ account: "AR", debit: value }, { account: "OWNER_EQUITY", credit: value }]
          : [{ account: "OWNER_EQUITY", debit: value }, { account: "AR", credit: value }],
      }, actorId);
    }
    await recordAuditEvent({
      actorId,
      action: "CUSTOMER_OPENING_BALANCE_SET",
      entityType: "Customer",
      entityId: customerId,
      metadata: { from: previous, to: amount, date: input.date, notes: input.notes || null },
    }, tx);
  });
  return getCustomerAccount(customerId);
}
