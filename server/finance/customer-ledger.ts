/*
 * The rows of customers' ledgers (D-052), read in one query: the old
 * balance, the old khata's lines (D-057), issued invoices, their credit
 * notes and posted payments.
 */

import { db } from "../core/database/client";
import type { Tx } from "../inventory/inventory.service";
import { type LedgerItem, type LedgerKind, money, runningLedger } from "./finance-rules";

type Runner = Tx | ReturnType<typeof db.runtime>;

export const cash = (value: unknown) => money(String(value ?? "0"));

const METHOD: Record<string, string> = { CASH: "cash", BANK_TRANSFER: "bank transfer", CHEQUE: "cheque", CARD: "card", OTHER: "other" };

export async function ledgerItems(runner: Runner, customerIds: string[]) {
  const byCustomer = new Map<string, LedgerItem[]>();
  if (!customerIds.length) return byCustomer;
  const result = (await runner.query(db.raw.sql`
    with ids as (select unnest(string_to_array(${customerIds.join(",")}::text, ','))::uuid as id)
    select c.id::text as "customerId", 'OPENING' as kind, coalesce(c."openingBalanceDate", '1900-01-01') as date, '' as reference,
      'Old balance (before the ERP)' as particulars, c."openingBalance"::text as debit, '0' as credit, c."createdAt"::text as at, null::text as "sourceId",
      '' as method, '' as extra
    from erp_customers c join ids on ids.id = c.id where c."openingBalance" <> 0
    union all
    select e."customerId"::text, 'OLD', e."entryDate", coalesce(e.reference, ''), e.description, e.debit::text, e.credit::text,
      lpad(e."lineNo"::text, 6, '0'), e.id::text, '',
      concat_ws('|', coalesce(e."poNumber", ''), coalesce(e."dcNumber", ''), case when e."dateMissing" then 'undated' else '' end)
    from erp_customer_ledger_entries e join ids on ids.id = e."customerId"
    union all
    select i."customerId"::text, 'INVOICE', i."invoiceDate", i."invoiceNumber",
      case when i."invoiceType" = 'NON_TAX' then 'Invoice' else 'Sales tax invoice' end, i."totalAmount"::text, '0',
      coalesce(i."issuedAt", i."createdAt")::text, i.id::text, '', ''
    from erp_invoices i join ids on ids.id = i."customerId" where i.status = 'ISSUED'
    union all
    select n."customerId"::text, 'CREDIT_NOTE', n."creditDate", n."creditNumber", 'Credit note', '0', n."totalAmount"::text,
      n."createdAt"::text, n.id::text, '', coalesce(i."invoiceNumber", '')
    from erp_credit_notes n join ids on ids.id = n."customerId" left join erp_invoices i on i.id = n."invoiceId"
    union all
    select r."customerId"::text, 'RECEIPT', r."receiptDate", r."receiptNumber", 'Payment received', '0', r.amount::text,
      r."createdAt"::text, r.id::text, r.method, coalesce(i."invoiceNumber", '') || '|' || coalesce(r.reference, '')
    from erp_customer_receipts r join ids on ids.id = r."customerId" left join erp_invoices i on i.id = r."invoiceId"
    where r.status = 'POSTED'
  `.returnsRow({
    customerId: "pg/text@1", kind: "pg/text@1", date: "pg/text@1", reference: "pg/text@1", particulars: "pg/text@1",
    debit: "pg/text@1", credit: "pg/text@1", at: "pg/text@1", sourceId: "pg/text@1", method: "pg/text@1", extra: "pg/text@1",
  }).build() as never)) as unknown as Array<Record<string, string | null>>;

  for (const row of result) {
    const kind = row.kind as LedgerKind;
    let particulars = row.particulars ?? "";
    if (kind === "CREDIT_NOTE" && row.extra) particulars += ` on ${row.extra}`;
    if (kind === "OLD") {
      const [po, dc, undated] = String(row.extra ?? "").split("|");
      const notes = [po && `PO ${po}`, dc && `DC ${dc}`, undated && "date not in the sheet"].filter(Boolean);
      particulars = [particulars || (Number(row.debit) > 0 ? "Old invoice" : "Payment received"), ...notes].join(" · ");
    }
    if (kind === "RECEIPT") {
      const [invoiceNumber, reference] = String(row.extra ?? "").split("|");
      particulars += ` (${METHOD[row.method ?? ""] ?? row.method}${reference ? ` ${reference}` : ""})${invoiceNumber ? ` for ${invoiceNumber}` : " on account"}`;
    }
    const item: LedgerItem = {
      date: row.date!, kind, reference: row.reference ?? "", particulars,
      debit: cash(row.debit), credit: cash(row.credit), at: row.at ?? "", sourceId: row.sourceId,
    };
    const list = byCustomer.get(row.customerId!) ?? [];
    list.push(item);
    byCustomer.set(row.customerId!, list);
  }
  return byCustomer;
}

export async function runningLedgerFor(runner: Runner, customerId: string, from: string, to: string) {
  const items = (await ledgerItems(runner, [customerId])).get(customerId) ?? [];
  const ledger = runningLedger(items, from, to);
  // The 1900 stand-in date of an undated old balance is shown blank.
  return { ...ledger, rows: ledger.rows.map((row) => ({ ...row, date: row.date === "1900-01-01" ? "" : row.date })) };
}

/* Each customer's ledger balance: what they owe now (negative: paid in advance). */
export async function customerBalances(customerIds: string[]) {
  const items = await ledgerItems(db.runtime(), customerIds);
  return new Map(customerIds.map((id) => [id, runningLedger(items.get(id) ?? []).balance]));
}
