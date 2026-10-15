/*
 * Invoicing and receivables (D-023).
 *
 * Invoice   DRAFT -> ISSUED, or DRAFT -> CANCELLED (compare-and-set). One
 *           active invoice per dispatched shipment (partial unique index).
 *           Prices, discounts and tax come from the sales order lines.
 * Credit    against an ISSUED invoice; per line, never more than was
 *           invoiced; never more than is still outstanding.
 * Receipt   against an ISSUED invoice; never more than is outstanding.
 *           Voided with a reason, never deleted.
 * Credits and receipts lock the invoice row, so concurrent postings cannot
 * together exceed the invoice.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { normalizeDecimalString, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import {
  AGING_BUCKETS,
  addDays,
  addMoney,
  agingBucket,
  compareMoney,
  creditLineAmounts,
  daysOverdue,
  lineAmounts,
  money,
  outstandingAmount,
  paymentStatus,
  sumAmounts,
  type LineAmounts,
} from "./finance-rules";
import type { CreditNoteInput, InvoiceInput, InvoiceQuery, ReceiptInput, ReceiptQuery } from "./finance.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const cash = (value: unknown) => money(String(value ?? "0"));

type Runner = Tx | ReturnType<typeof db.runtime>;

async function rows<T>(runner: Runner, plan: unknown) {
  return (await runner.query(plan as never)) as unknown as T[];
}

function invoiceNotFound(): never {
  throw new AppError("Invoice not found.", { code: "INVOICE_NOT_FOUND", status: 404 });
}

function isUnique(error: unknown, fragment: string) {
  const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
  return sqlError?.sqlState === "23505" && Boolean(sqlError.constraint?.includes(fragment));
}

/* Credited and received totals for one invoice (posted receipts only). */
async function balances(runner: Runner, invoiceId: string) {
  const [row] = await rows<{ credited: string; received: string }>(runner, db.raw.sql`
    select
      (select coalesce(sum("totalAmount"), 0) from erp_credit_notes where "invoiceId" = ${invoiceId}::uuid)::text as credited,
      (select coalesce(sum(amount), 0) from erp_customer_receipts where "invoiceId" = ${invoiceId}::uuid and status = 'POSTED')::text as received
  `.returnsRow({ credited: "pg/text@1", received: "pg/text@1" }).build());
  return { credited: cash(row.credited), received: cash(row.received) };
}

async function lockInvoice(tx: Tx, invoiceId: string) {
  const [row] = await rows<{ status: string; total: string }>(tx, db.raw.sql`
    select status, "totalAmount"::text as total from erp_invoices where id = ${invoiceId}::uuid for update
  `.returnsRow({ status: "pg/text@1", total: "pg/text@1" }).build());
  if (!row) invoiceNotFound();
  if (row.status !== "ISSUED") {
    throw new AppError(`The invoice is ${row.status.toLowerCase()}; only issued invoices can be credited or paid.`, { code: "INVOICE_NOT_ISSUED", status: 409 });
  }
  return { total: cash(row.total), ...(await balances(tx, invoiceId)) };
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export async function createInvoice(input: InvoiceInput, actorId: string) {
  const replay = await db.orm.public.Invoice.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getInvoice(replay.id);

  const shipment = await db.orm.public.Shipment.where({ id: input.shipmentId }).first();
  if (!shipment) {
    throw new AppError("Shipment not found.", { code: "SHIPMENT_NOT_FOUND", status: 400 });
  }
  if (!["DISPATCHED", "DELIVERED"].includes(shipment.status)) {
    throw new AppError("Only dispatched or delivered shipments can be invoiced.", { code: "SHIPMENT_NOT_DISPATCHED", status: 409 });
  }

  const shipmentLines = await db.orm.public.ShipmentLine.where({ shipmentId: shipment.id }).orderBy((line) => line.lineNo.asc()).all();
  const orderLines = await db.orm.public.SalesOrderLine.where({ salesOrderId: shipment.salesOrderId }).all();

  const lines = shipmentLines.map((line, index) => {
    const candidates = line.salesOrderLineId
      ? orderLines.filter((orderLine) => orderLine.id === line.salesOrderLineId)
      : orderLines.filter((orderLine) => orderLine.productId === line.productId && !orderLine.isCustom);
    const terms = new Set(candidates.map((orderLine) => `${dec(orderLine.unitPrice)}|${orderLine.discountPercent}|${orderLine.taxPercent}`));
    if (!candidates.length || terms.size !== 1) {
      throw new AppError(
        candidates.length
          ? `Shipment line ${index + 1}: the sales order has this item at more than one price or tax rate, so the price to invoice is ambiguous.`
          : `Shipment line ${index + 1}: no matching sales order line.`,
        { code: "INVOICE_PRICE_UNRESOLVED", status: 409 },
      );
    }
    const orderLine = candidates[0];
    const quantity = dec(line.quantity);
    const unitPrice = dec(orderLine.unitPrice);
    return {
      lineNo: index + 1,
      productId: line.productId,
      salesOrderLineId: orderLine.id,
      description: orderLine.productName,
      unit: orderLine.unit,
      quantity,
      unitPrice,
      discountPercent: orderLine.discountPercent,
      taxPercent: orderLine.taxPercent,
      ...lineAmounts(quantity, unitPrice, orderLine.discountPercent, orderLine.taxPercent),
    };
  });
  const totals = sumAmounts(lines);

  try {
    const id = await db.transaction(async (tx) => {
      const invoiceNumber = await allocateDocumentNumber(tx, "INV");
      const invoice = await tx.orm.public.Invoice.create({
        invoiceNumber,
        customerId: shipment.customerId,
        salesOrderId: shipment.salesOrderId,
        shipmentId: shipment.id,
        invoiceDate: input.invoiceDate,
        dueDate: addDays(input.invoiceDate, input.paymentTermsDays),
        subtotal: totals.grossAmount,
        discountTotal: totals.discountAmount,
        taxTotal: totals.taxAmount,
        totalAmount: totals.lineTotal,
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      for (const line of lines) {
        await tx.orm.public.InvoiceLine.create({ invoiceId: invoice.id, ...line });
      }
      await recordAuditEvent({
        actorId,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: invoice.id,
        metadata: { invoiceNumber, shipmentId: shipment.id, total: totals.lineTotal },
      }, tx);
      return invoice.id;
    });
    return getInvoice(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.Invoice.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getInvoice(original.id);
    }
    if (isUnique(error, "one_per_shipment")) {
      throw new AppError("This shipment already has an invoice. Cancel the draft first, or correct an issued invoice with a credit note.", {
        code: "INVOICE_EXISTS",
        status: 409,
      });
    }
    throw error;
  }
}

export async function changeInvoice(id: string, action: "issue" | "cancel", reason: string, actorId: string) {
  if (!UUID.test(id)) invoiceNotFound();
  const status = action === "issue" ? "ISSUED" : "CANCELLED";

  await db.transaction(async (tx) => {
    const updated = await rows<{ invoiceNumber: string }>(tx, db.raw.sql`
      update erp_invoices set status = ${status},
        "issuedBy" = case when ${status} = 'ISSUED' then ${actorId}::uuid else "issuedBy" end,
        "issuedAt" = case when ${status} = 'ISSUED' then now() else "issuedAt" end,
        "cancelledBy" = case when ${status} = 'CANCELLED' then ${actorId}::uuid else "cancelledBy" end,
        "cancelledAt" = case when ${status} = 'CANCELLED' then now() else "cancelledAt" end,
        "cancelReason" = case when ${status} = 'CANCELLED' then ${reason} else "cancelReason" end
      where id = ${id}::uuid and status = 'DRAFT'
      returning "invoiceNumber"
    `.returnsRow({ invoiceNumber: "pg/text@1" }).build());

    if (!updated.length) {
      const existing = await tx.orm.public.Invoice.where({ id }).first();
      if (!existing) invoiceNotFound();
      throw new AppError(
        existing.status === "ISSUED" && action === "cancel"
          ? "Issued invoices cannot be cancelled; issue a credit note instead."
          : `This invoice is already ${existing.status.toLowerCase()}.`,
        { code: "INVOICE_STATUS_CONFLICT", status: 409 },
      );
    }

    await recordAuditEvent({
      actorId,
      action: action === "issue" ? "INVOICE_ISSUED" : "INVOICE_CANCELLED",
      entityType: "Invoice",
      entityId: id,
      metadata: { invoiceNumber: updated[0].invoiceNumber, reason: reason || null },
    }, tx);
  });

  return getInvoice(id);
}

/* ------------------------------------------------------------------ */
/* Credit notes                                                        */
/* ------------------------------------------------------------------ */

async function creditedByLine(runner: Runner, invoiceId: string) {
  const result = await rows<{ invoiceLineId: string; quantity: string; gross: string; discount: string; tax: string; total: string }>(runner, db.raw.sql`
    select l."invoiceLineId"::text as "invoiceLineId", sum(l.quantity)::text as quantity,
      sum(l."grossAmount")::text as gross, sum(l."discountAmount")::text as discount,
      sum(l."taxAmount")::text as tax, sum(l."lineTotal")::text as total
    from erp_credit_note_lines l join erp_credit_notes c on c.id = l."creditNoteId"
    where c."invoiceId" = ${invoiceId}::uuid
    group by l."invoiceLineId"
  `.returnsRow({ invoiceLineId: "pg/text@1", quantity: "pg/text@1", gross: "pg/text@1", discount: "pg/text@1", tax: "pg/text@1", total: "pg/text@1" }).build());
  return new Map(result.map((row) => [row.invoiceLineId, {
    quantity: dec(row.quantity),
    grossAmount: cash(row.gross),
    discountAmount: cash(row.discount),
    taxAmount: cash(row.tax),
    lineTotal: cash(row.total),
  }]));
}

const NOTHING_CREDITED = { quantity: "0", grossAmount: "0.00", discountAmount: "0.00", taxAmount: "0.00", lineTotal: "0.00" };

export async function createCreditNote(input: CreditNoteInput, actorId: string) {
  const replay = await db.orm.public.CreditNote.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getCreditNote(replay.id);

  try {
    const id = await db.transaction(async (tx) => {
      const balance = await lockInvoice(tx, input.invoiceId);
      const invoice = (await tx.orm.public.Invoice.where({ id: input.invoiceId }).first())!;
      const invoiceLines = await tx.orm.public.InvoiceLine.where({ invoiceId: invoice.id }).all();
      const credited = await creditedByLine(tx, invoice.id);

      const lines: Array<{ invoiceLineId: string; quantity: string } & LineAmounts> = input.lines.map((requested) => {
        const line = invoiceLines.find((item) => item.id === requested.invoiceLineId);
        if (!line) {
          throw new AppError("A credited line does not belong to this invoice.", { code: "INVOICE_LINE_NOT_FOUND", status: 400 });
        }
        const quantity = toPlainDecimalString(requested.quantity);
        const amounts = creditLineAmounts({
          quantity: dec(line.quantity),
          unitPrice: dec(line.unitPrice),
          discountPercent: line.discountPercent,
          taxPercent: line.taxPercent,
          grossAmount: cash(line.grossAmount),
          discountAmount: cash(line.discountAmount),
          taxAmount: cash(line.taxAmount),
          lineTotal: cash(line.lineTotal),
        }, credited.get(line.id) ?? NOTHING_CREDITED, quantity);
        if (!amounts) {
          const left = subtractDecimalStrings(dec(line.quantity), (credited.get(line.id) ?? NOTHING_CREDITED).quantity);
          throw new AppError(`Line ${line.lineNo} (${line.description}): only ${left} ${line.unit} can still be credited.`, { code: "CREDIT_EXCEEDS_INVOICED", status: 409 });
        }
        return { invoiceLineId: line.id, quantity, ...amounts };
      });

      const totals = sumAmounts(lines);
      const outstanding = outstandingAmount(balance.total, balance.credited, balance.received);
      if (compareMoney(totals.lineTotal, "0") <= 0) {
        throw new AppError("The credit amounts to zero.", { code: "CREDIT_ZERO", status: 400 });
      }
      if (compareMoney(totals.lineTotal, outstanding) > 0) {
        throw new AppError(`This credit (${totals.lineTotal}) is more than the invoice's outstanding balance (${outstanding}). Void receipts first; refunds are not supported yet.`, {
          code: "CREDIT_EXCEEDS_OUTSTANDING",
          status: 409,
        });
      }

      const creditNumber = await allocateDocumentNumber(tx, "CRN");
      const note = await tx.orm.public.CreditNote.create({
        creditNumber,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        creditDate: input.creditDate,
        reason: input.reason,
        subtotal: totals.grossAmount,
        discountTotal: totals.discountAmount,
        taxTotal: totals.taxAmount,
        totalAmount: totals.lineTotal,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      for (const line of lines) {
        await tx.orm.public.CreditNoteLine.create({ creditNoteId: note.id, ...line });
      }
      await recordAuditEvent({
        actorId,
        action: "CREDIT_NOTE_ISSUED",
        entityType: "CreditNote",
        entityId: note.id,
        metadata: { creditNumber, invoiceId: invoice.id, total: totals.lineTotal },
      }, tx);
      return note.id;
    });
    return getCreditNote(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.CreditNote.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getCreditNote(original.id);
    }
    throw error;
  }
}

export async function getCreditNote(id: string) {
  if (!UUID.test(id)) throw new AppError("Credit note not found.", { code: "CREDIT_NOTE_NOT_FOUND", status: 404 });
  const note = await db.orm.public.CreditNote.where({ id }).first();
  if (!note) throw new AppError("Credit note not found.", { code: "CREDIT_NOTE_NOT_FOUND", status: 404 });
  const lines = await db.orm.public.CreditNoteLine.where({ creditNoteId: id }).all();
  const invoiceLines = await db.orm.public.InvoiceLine.where({ invoiceId: note.invoiceId }).all();
  const invoice = await db.orm.public.Invoice.where({ id: note.invoiceId }).first();
  const customer = await db.orm.public.Customer.where({ id: note.customerId }).first();
  return {
    ...note,
    subtotal: cash(note.subtotal),
    discountTotal: cash(note.discountTotal),
    taxTotal: cash(note.taxTotal),
    totalAmount: cash(note.totalAmount),
    invoiceNumber: invoice?.invoiceNumber ?? null,
    customerName: customer?.name ?? null,
    lines: lines
      .map((line) => {
        const source = invoiceLines.find((item) => item.id === line.invoiceLineId);
        return {
          ...line,
          lineNo: source?.lineNo ?? 0,
          description: source?.description ?? null,
          unit: source?.unit ?? null,
          unitPrice: source ? dec(source.unitPrice) : null,
          taxPercent: source?.taxPercent ?? null,
          quantity: dec(line.quantity),
          grossAmount: cash(line.grossAmount),
          discountAmount: cash(line.discountAmount),
          taxAmount: cash(line.taxAmount),
          lineTotal: cash(line.lineTotal),
        };
      })
      .sort((a, b) => a.lineNo - b.lineNo),
  };
}

/* ------------------------------------------------------------------ */
/* Receipts                                                            */
/* ------------------------------------------------------------------ */

export async function recordReceipt(input: ReceiptInput, actorId: string) {
  const replay = await db.orm.public.CustomerReceipt.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getReceipt(replay.id);
  const amount = money(toPlainDecimalString(input.amount));

  try {
    const id = await db.transaction(async (tx) => {
      const balance = await lockInvoice(tx, input.invoiceId);
      const outstanding = outstandingAmount(balance.total, balance.credited, balance.received);
      if (compareMoney(amount, outstanding) > 0) {
        throw new AppError(`Only ${outstanding} is outstanding on this invoice.`, { code: "RECEIPT_EXCEEDS_OUTSTANDING", status: 409, details: { outstanding } });
      }
      const invoice = (await tx.orm.public.Invoice.where({ id: input.invoiceId }).first())!;
      const receiptNumber = await allocateDocumentNumber(tx, "RCT");
      const receipt = await tx.orm.public.CustomerReceipt.create({
        receiptNumber,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        receiptDate: input.receiptDate,
        method: input.method,
        reference: input.reference || null,
        amount,
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      await recordAuditEvent({
        actorId,
        action: "RECEIPT_POSTED",
        entityType: "CustomerReceipt",
        entityId: receipt.id,
        metadata: { receiptNumber, invoiceId: invoice.id, amount },
      }, tx);
      return receipt.id;
    });
    return getReceipt(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.CustomerReceipt.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getReceipt(original.id);
    }
    throw error;
  }
}

export async function voidReceipt(id: string, reason: string, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Receipt not found.", { code: "RECEIPT_NOT_FOUND", status: 404 });
  await db.transaction(async (tx) => {
    const updated = await rows<{ receiptNumber: string }>(tx, db.raw.sql`
      update erp_customer_receipts set status = 'VOIDED', "voidedBy" = ${actorId}::uuid, "voidedAt" = now(), "voidReason" = ${reason}
      where id = ${id}::uuid and status = 'POSTED'
      returning "receiptNumber"
    `.returnsRow({ receiptNumber: "pg/text@1" }).build());
    if (!updated.length) {
      const existing = await tx.orm.public.CustomerReceipt.where({ id }).first();
      if (!existing) throw new AppError("Receipt not found.", { code: "RECEIPT_NOT_FOUND", status: 404 });
      throw new AppError("This receipt is already voided.", { code: "RECEIPT_STATUS_CONFLICT", status: 409 });
    }
    await recordAuditEvent({
      actorId,
      action: "RECEIPT_VOIDED",
      entityType: "CustomerReceipt",
      entityId: id,
      metadata: { receiptNumber: updated[0].receiptNumber, reason },
    }, tx);
  });
  return getReceipt(id);
}

export async function getReceipt(id: string) {
  if (!UUID.test(id)) throw new AppError("Receipt not found.", { code: "RECEIPT_NOT_FOUND", status: 404 });
  const receipt = await db.orm.public.CustomerReceipt.where({ id }).first();
  if (!receipt) throw new AppError("Receipt not found.", { code: "RECEIPT_NOT_FOUND", status: 404 });
  const invoice = await db.orm.public.Invoice.where({ id: receipt.invoiceId }).first();
  const customer = await db.orm.public.Customer.where({ id: receipt.customerId }).first();
  const users = await db.orm.public.User.where((user) => user.id.in([receipt.createdBy, receipt.voidedBy].filter(Boolean) as string[])).select("id", "name").all();
  return {
    ...receipt,
    amount: cash(receipt.amount),
    invoiceNumber: invoice?.invoiceNumber ?? null,
    customerName: customer?.name ?? null,
    createdByName: users.find((user) => user.id === receipt.createdBy)?.name ?? null,
    voidedByName: users.find((user) => user.id === receipt.voidedBy)?.name ?? null,
  };
}

export async function listReceipts(filters: ReceiptQuery) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select r.id::text as id, r."receiptNumber", r."receiptDate", r.method, coalesce(r.reference, '') as reference,
      r.amount::text as amount, r.status, i.id::text as "invoiceId", i."invoiceNumber", c.name as "customerName"
    from erp_customer_receipts r
    join erp_invoices i on i.id = r."invoiceId"
    join erp_customers c on c.id = r."customerId"
    where (${filters.status} = '' or r.status = ${filters.status})
      and (${filters.search} = '' or r."receiptNumber" ilike ${pattern} or i."invoiceNumber" ilike ${pattern}
        or c.name ilike ${pattern} or coalesce(r.reference, '') ilike ${pattern})
    order by r."createdAt" desc, r.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({
    id: "pg/text@1", receiptNumber: "pg/text@1", receiptDate: "pg/text@1", method: "pg/text@1", reference: "pg/text@1",
    amount: "pg/text@1", status: "pg/text@1", invoiceId: "pg/text@1", invoiceNumber: "pg/text@1", customerName: "pg/text@1",
  }).build());
  return {
    receipts: result.slice(0, filters.pageSize).map((row) => ({ ...row, amount: cash(row.amount) })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* Reading invoices                                                    */
/* ------------------------------------------------------------------ */

export async function getInvoice(id: string, today = new Date().toISOString().slice(0, 10)) {
  if (!UUID.test(id)) invoiceNotFound();
  const invoice = await db.orm.public.Invoice.where({ id }).first();
  if (!invoice) invoiceNotFound();

  const [lines, notes, receipts, customer, order, shipment, balance, credited] = await Promise.all([
    db.orm.public.InvoiceLine.where({ invoiceId: id }).orderBy((line) => line.lineNo.asc()).all(),
    db.orm.public.CreditNote.where({ invoiceId: id }).orderBy((note) => note.createdAt.asc()).all(),
    db.orm.public.CustomerReceipt.where({ invoiceId: id }).orderBy((receipt) => receipt.createdAt.asc()).all(),
    db.orm.public.Customer.where({ id: invoice.customerId }).first(),
    db.orm.public.SalesOrder.where({ id: invoice.salesOrderId }).first(),
    db.orm.public.Shipment.where({ id: invoice.shipmentId }).first(),
    balances(db.runtime(), id),
    creditedByLine(db.runtime(), id),
  ]);
  const products = lines.length
    ? await db.orm.public.Product.where((product) => product.id.in(lines.map((line) => line.productId).filter(Boolean) as string[])).all()
    : [];
  const total = cash(invoice.totalAmount);
  const outstanding = outstandingAmount(total, balance.credited, balance.received);

  return {
    ...invoice,
    subtotal: cash(invoice.subtotal),
    discountTotal: cash(invoice.discountTotal),
    taxTotal: cash(invoice.taxTotal),
    totalAmount: total,
    customerName: customer?.name ?? null,
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
    salesOrderNumber: order?.orderNumber ?? null,
    shipmentNumber: shipment?.shipmentNumber ?? null,
    credited: balance.credited,
    received: balance.received,
    outstanding,
    paymentStatus: invoice.status === "ISSUED" ? paymentStatus(total, balance.credited, balance.received) : null,
    daysOverdue: invoice.status === "ISSUED" && compareMoney(outstanding, "0") > 0 ? daysOverdue(invoice.dueDate, today) : 0,
    lines: lines.map((line) => ({
      ...line,
      sku: products.find((product) => product.id === line.productId)?.sku ?? null,
      quantity: dec(line.quantity),
      unitPrice: dec(line.unitPrice),
      grossAmount: cash(line.grossAmount),
      discountAmount: cash(line.discountAmount),
      taxAmount: cash(line.taxAmount),
      lineTotal: cash(line.lineTotal),
      creditedQuantity: credited.get(line.id)?.quantity ?? "0",
    })),
    creditNotes: notes.map((note) => ({ id: note.id, creditNumber: note.creditNumber, creditDate: note.creditDate, reason: note.reason, totalAmount: cash(note.totalAmount) })),
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      receiptDate: receipt.receiptDate,
      method: receipt.method,
      reference: receipt.reference,
      amount: cash(receipt.amount),
      status: receipt.status,
      voidReason: receipt.voidReason,
    })),
  };
}

const INVOICE_COLUMNS = {
  id: "pg/text@1", invoiceNumber: "pg/text@1", invoiceDate: "pg/text@1", dueDate: "pg/text@1", status: "pg/text@1",
  totalAmount: "pg/text@1", credited: "pg/text@1", received: "pg/text@1", customerId: "pg/text@1", customerName: "pg/text@1",
  salesOrderNumber: "pg/text@1", shipmentNumber: "pg/text@1",
} as const;

export async function listInvoices(filters: InvoiceQuery, today = new Date().toISOString().slice(0, 10)) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<keyof typeof INVOICE_COLUMNS, string>>(db.runtime(), db.raw.sql`
    select * from (
      select i.id::text as id, i."invoiceNumber", i."invoiceDate", i."dueDate", i.status, i."totalAmount"::text as "totalAmount",
        coalesce(cn.total, 0)::text as credited, coalesce(r.total, 0)::text as received,
        i."customerId"::text as "customerId", c.name as "customerName", so."orderNumber" as "salesOrderNumber",
        s."shipmentNumber", i."createdAt",
        i."totalAmount" - coalesce(cn.total, 0) - coalesce(r.total, 0) as outstanding
      from erp_invoices i
      join erp_customers c on c.id = i."customerId"
      join erp_sales_orders so on so.id = i."salesOrderId"
      join erp_shipments s on s.id = i."shipmentId"
      left join (select "invoiceId", sum("totalAmount") as total from erp_credit_notes group by "invoiceId") cn on cn."invoiceId" = i.id
      left join (select "invoiceId", sum(amount) as total from erp_customer_receipts where status = 'POSTED' group by "invoiceId") r on r."invoiceId" = i.id
    ) x
    where (${filters.status} = '' or x.status = ${filters.status})
      and (${filters.customerId ?? ""} = '' or x."customerId" = ${filters.customerId ?? ""})
      and (${filters.balance} <> 'open' or (x.status = 'ISSUED' and x.outstanding > 0))
      and (${filters.balance} <> 'overdue' or (x.status = 'ISSUED' and x.outstanding > 0 and x."dueDate" < ${today}))
      and (${filters.balance} <> 'paid' or (x.status = 'ISSUED' and x.outstanding <= 0))
      and (${filters.search} = '' or x."invoiceNumber" ilike ${pattern} or x."customerName" ilike ${pattern}
        or x."salesOrderNumber" ilike ${pattern} or x."shipmentNumber" ilike ${pattern})
    order by x."createdAt" desc, x.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow(INVOICE_COLUMNS).build());

  return {
    invoices: result.slice(0, filters.pageSize).map((row) => {
      const total = cash(row.totalAmount);
      const credited = cash(row.credited);
      const received = cash(row.received);
      const outstanding = outstandingAmount(total, credited, received);
      return {
        ...row,
        totalAmount: total,
        credited,
        received,
        outstanding,
        paymentStatus: row.status === "ISSUED" ? paymentStatus(total, credited, received) : null,
        daysOverdue: row.status === "ISSUED" && compareMoney(outstanding, "0") > 0 ? daysOverdue(row.dueDate, today) : 0,
      };
    }),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

/* Dispatched or delivered shipments that have no active invoice yet. */
export async function listUninvoicedShipments() {
  const result = await rows<{ id: string; shipmentNumber: string; status: string; dispatchedAt: string; salesOrderNumber: string; customerName: string; lineCount: string }>(db.runtime(), db.raw.sql`
    select s.id::text as id, s."shipmentNumber", s.status, coalesce(s."dispatchedAt"::text, '') as "dispatchedAt",
      so."orderNumber" as "salesOrderNumber", c.name as "customerName",
      (select count(*) from erp_shipment_lines l where l."shipmentId" = s.id)::text as "lineCount"
    from erp_shipments s
    join erp_sales_orders so on so.id = s."salesOrderId"
    join erp_customers c on c.id = s."customerId"
    where s.status in ('DISPATCHED', 'DELIVERED')
      and not exists (select 1 from erp_invoices i where i."shipmentId" = s.id and i.status <> 'CANCELLED')
    order by s."dispatchedAt" desc nulls last
    limit 200
  `.returnsRow({ id: "pg/text@1", shipmentNumber: "pg/text@1", status: "pg/text@1", dispatchedAt: "pg/text@1", salesOrderNumber: "pg/text@1", customerName: "pg/text@1", lineCount: "pg/text@1" }).build());
  return result.map((row) => ({ ...row, lineCount: Number(row.lineCount) }));
}

/* ------------------------------------------------------------------ */
/* Receivables                                                         */
/* ------------------------------------------------------------------ */

export async function getReceivables(today = new Date().toISOString().slice(0, 10)) {
  const open = await rows<{ customerId: string; customerName: string; dueDate: string; outstanding: string }>(db.runtime(), db.raw.sql`
    select i."customerId"::text as "customerId", c.name as "customerName", i."dueDate",
      (i."totalAmount" - coalesce(cn.total, 0) - coalesce(r.total, 0))::text as outstanding
    from erp_invoices i
    join erp_customers c on c.id = i."customerId"
    left join (select "invoiceId", sum("totalAmount") as total from erp_credit_notes group by "invoiceId") cn on cn."invoiceId" = i.id
    left join (select "invoiceId", sum(amount) as total from erp_customer_receipts where status = 'POSTED' group by "invoiceId") r on r."invoiceId" = i.id
    where i.status = 'ISSUED' and i."totalAmount" - coalesce(cn.total, 0) - coalesce(r.total, 0) > 0
  `.returnsRow({ customerId: "pg/text@1", customerName: "pg/text@1", dueDate: "pg/text@1", outstanding: "pg/text@1" }).build());

  const empty = () => Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket, "0.00"])) as Record<(typeof AGING_BUCKETS)[number], string>;
  const add = addMoney;
  const customers = new Map<string, { customerId: string; customerName: string; invoices: number; total: string; buckets: ReturnType<typeof empty> }>();
  const totals = { invoices: 0, total: "0.00", buckets: empty() };

  for (const row of open) {
    const bucket = agingBucket(row.dueDate, today);
    const amount = cash(row.outstanding);
    const entry = customers.get(row.customerId) ?? { customerId: row.customerId, customerName: row.customerName, invoices: 0, total: "0.00", buckets: empty() };
    entry.invoices += 1;
    entry.total = add(entry.total, amount);
    entry.buckets[bucket] = add(entry.buckets[bucket], amount);
    customers.set(row.customerId, entry);
    totals.invoices += 1;
    totals.total = add(totals.total, amount);
    totals.buckets[bucket] = add(totals.buckets[bucket], amount);
  }

  return {
    asOf: today,
    buckets: AGING_BUCKETS,
    totals,
    customers: [...customers.values()].sort((a, b) => compareMoney(b.total, a.total) || a.customerName.localeCompare(b.customerName)),
  };
}

/* Counts and amounts for the finance overview. */
export async function getFinanceSummary(today = new Date().toISOString().slice(0, 10)) {
  const receivables = await getReceivables(today);
  const [counts] = await rows<{ drafts: string; uninvoiced: string; received30: string; issued30: string }>(db.runtime(), db.raw.sql`
    select
      (select count(*) from erp_invoices where status = 'DRAFT')::text as drafts,
      (select count(*) from erp_shipments s where s.status in ('DISPATCHED', 'DELIVERED')
        and not exists (select 1 from erp_invoices i where i."shipmentId" = s.id and i.status <> 'CANCELLED'))::text as uninvoiced,
      (select coalesce(sum(amount), 0) from erp_customer_receipts where status = 'POSTED' and "receiptDate" > ${addDays(today, -30)} and "receiptDate" <= ${today})::text as received30,
      (select coalesce(sum("totalAmount"), 0) from erp_invoices where status = 'ISSUED' and "invoiceDate" > ${addDays(today, -30)} and "invoiceDate" <= ${today})::text as issued30
  `.returnsRow({ drafts: "pg/text@1", uninvoiced: "pg/text@1", received30: "pg/text@1", issued30: "pg/text@1" }).build());
  const overdue = AGING_BUCKETS.filter((bucket) => bucket !== "current")
    .reduce((sum, bucket) => addMoney(sum, receivables.totals.buckets[bucket]), "0.00");

  return {
    asOf: today,
    receivable: receivables.totals.total,
    overdue,
    openInvoices: receivables.totals.invoices,
    draftInvoices: Number(counts.drafts),
    uninvoicedShipments: Number(counts.uninvoiced),
    receivedLast30Days: cash(counts.received30),
    invoicedLast30Days: cash(counts.issued30),
  };
}
