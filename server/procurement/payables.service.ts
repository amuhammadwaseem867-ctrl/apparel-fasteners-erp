/*
 * Accounts payable (D-029): supplier bills with a three-way match against
 * the purchase order and goods received, supplier payments and ageing.
 *
 * Bill     DRAFT -> APPROVED -> (paid by payments); DRAFT or unpaid APPROVED
 *          bills can be CANCELLED. Approval moves PO-line billedQuantity by
 *          compare-and-set, so a PO line is never billed beyond what was
 *          received, even under concurrent approvals. A bill price above the
 *          PO price is refused at approval.
 * Payment  POSTED against an approved bill, never above its outstanding
 *          balance (bill row locked); VOIDED with a reason.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { compareDecimalStrings, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { AGING_BUCKETS, addDays, addMoney, agingBucket, compareMoney, daysOverdue, lineAmounts, money, sumAmounts } from "../finance/finance-rules";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import { cash, dec, isUnique, notFound, rows, UUID } from "./procurement.service";
import type { BillInput, ListQuery, SupplierPaymentInput } from "./procurement.validation";

const today = () => new Date().toISOString().slice(0, 10);

async function paidOn(tx: Tx | ReturnType<typeof db.runtime>, billId: string) {
  const [row] = await rows<{ paid: string }>(tx, db.raw.sql`
    select coalesce(sum(amount), 0)::text as paid from erp_supplier_payments where "billId" = ${billId}::uuid and status = 'POSTED'
  `.returnsRow({ paid: "pg/text@1" }).build());
  return cash(row.paid);
}

export async function createBill(input: BillInput, actorId: string) {
  const replay = await db.orm.public.SupplierBill.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getBill(replay.id);

  const supplier = await db.orm.public.Supplier.where({ id: input.supplierId }).first();
  if (!supplier) throw new AppError("Supplier not found.", { code: "SUPPLIER_NOT_FOUND", status: 400 });
  const poLines = input.purchaseOrderId ? await db.orm.public.PurchaseOrderLine.where({ purchaseOrderId: input.purchaseOrderId }).all() : [];
  if (input.purchaseOrderId) {
    const order = await db.orm.public.PurchaseOrder.where({ id: input.purchaseOrderId }).first();
    if (!order) throw new AppError("Purchase order not found.", { code: "PURCHASE_ORDER_NOT_FOUND", status: 400 });
    if (order.supplierId !== input.supplierId) throw new AppError("That purchase order belongs to another supplier.", { code: "BILL_SUPPLIER_MISMATCH", status: 409 });
    if (["DRAFT", "CANCELLED"].includes(order.status)) throw new AppError("Bills can only be raised against approved purchase orders.", { code: "PURCHASE_ORDER_NOT_OPEN", status: 409 });
  }
  const products = poLines.length ? await db.orm.public.Product.where((product) => product.id.in(poLines.map((line) => line.productId))).all() : [];

  const lines = input.lines.map((item, index) => {
    if (!item.purchaseOrderLineId) {
      const quantity = toPlainDecimalString(item.quantity);
      const unitPrice = toPlainDecimalString(item.unitPrice!);
      const discountPercent = item.discountPercent ?? 0;
      const taxPercent = item.taxPercent ?? 0;
      return { purchaseOrderLineId: null, productId: null, description: item.description!, quantity, unitPrice, discountPercent, taxPercent, ...lineAmounts(quantity, unitPrice, discountPercent, taxPercent) };
    }
    const poLine = poLines.find((line) => line.id === item.purchaseOrderLineId);
    if (!poLine) throw new AppError(`Line ${index + 1} is not on the chosen purchase order.`, { code: "PO_LINE_NOT_FOUND", status: 400 });
    const product = products.find((row) => row.id === poLine.productId);
    const quantity = toPlainDecimalString(item.quantity);
    const billable = subtractDecimalStrings(dec(poLine.receivedQuantity), dec(poLine.billedQuantity));
    if (compareDecimalStrings(quantity, billable) > 0) {
      throw new AppError(`Line ${index + 1} (${product?.sku}): only ${billable} received and not yet billed.`, { code: "BILL_EXCEEDS_RECEIVED", status: 409, details: { billable } });
    }
    const unitPrice = item.unitPrice === undefined ? dec(poLine.unitPrice) : toPlainDecimalString(item.unitPrice);
    const discountPercent = item.discountPercent ?? poLine.discountPercent;
    const taxPercent = item.taxPercent ?? poLine.taxPercent;
    return {
      purchaseOrderLineId: poLine.id, productId: poLine.productId, description: item.description || `${product?.sku ?? ""} ${product?.name ?? ""}`.trim(),
      quantity, unitPrice, discountPercent, taxPercent, ...lineAmounts(quantity, unitPrice, discountPercent, taxPercent),
    };
  });
  const ids = lines.map((line) => line.purchaseOrderLineId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new AppError("Each PO line can appear once per bill.", { code: "BILL_DUPLICATE_LINE", status: 400 });
  const totals = sumAmounts(lines);

  try {
    const id = await db.transaction(async (tx) => {
      const billNumber = await allocateDocumentNumber(tx, "BILL");
      const bill = await tx.orm.public.SupplierBill.create({
        billNumber, supplierId: input.supplierId, purchaseOrderId: input.purchaseOrderId ?? null, supplierInvoiceNumber: input.supplierInvoiceNumber,
        billDate: input.billDate, dueDate: input.dueDate || addDays(input.billDate, supplier.paymentTermsDays),
        subtotal: totals.grossAmount, discountTotal: totals.discountAmount, taxTotal: totals.taxAmount, totalAmount: totals.lineTotal,
        notes: input.notes || null, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      for (const [index, line] of lines.entries()) await tx.orm.public.SupplierBillLine.create({ billId: bill.id, lineNo: index + 1, ...line });
      await recordAuditEvent({ actorId, action: "SUPPLIER_BILL_CREATED", entityType: "SupplierBill", entityId: bill.id, metadata: { billNumber, total: totals.lineTotal } }, tx);
      return bill.id;
    });
    return getBill(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.SupplierBill.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getBill(original.id);
    }
    if (isUnique(error, "unique_invoice")) {
      throw new AppError(`Supplier invoice ${input.supplierInvoiceNumber} is already recorded for this supplier.`, { code: "SUPPLIER_INVOICE_DUPLICATE", status: 409 });
    }
    throw error;
  }
}

export async function changeBill(id: string, action: "approve" | "cancel", reason: string, actorId: string) {
  if (!UUID.test(id)) notFound("Bill", "BILL_NOT_FOUND");
  await db.transaction(async (tx) => {
    const [locked] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_supplier_bills where id = ${id}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
    if (!locked) notFound("Bill", "BILL_NOT_FOUND");
    const lines = await tx.orm.public.SupplierBillLine.where({ billId: id }).all();
    const now = new Date().toISOString();

    if (action === "approve") {
      if (locked.status !== "DRAFT") throw new AppError("Only draft bills can be approved.", { code: "BILL_STATUS_CONFLICT", status: 409 });
      for (const line of lines.filter((item) => item.purchaseOrderLineId)) {
        const poLine = (await tx.orm.public.PurchaseOrderLine.where({ id: line.purchaseOrderLineId! }).first())!;
        if (compareDecimalStrings(dec(line.unitPrice), dec(poLine.unitPrice)) > 0) {
          throw new AppError(`Line ${line.lineNo}: billed price ${dec(line.unitPrice)} is above the PO price ${dec(poLine.unitPrice)}.`, { code: "BILL_PRICE_ABOVE_PO", status: 409 });
        }
        const moved = await rows<{ id: string }>(tx, db.raw.sql`
          update erp_purchase_order_lines set "billedQuantity" = "billedQuantity" + ${dec(line.quantity)}::numeric
          where id = ${line.purchaseOrderLineId!}::uuid and "billedQuantity" + ${dec(line.quantity)}::numeric <= "receivedQuantity"
          returning id::text as id
        `.returnsRow({ id: "pg/text@1" }).build());
        if (!moved.length) {
          throw new AppError(`Line ${line.lineNo}: billing ${dec(line.quantity)} would exceed the quantity received and not yet billed.`, { code: "BILL_EXCEEDS_RECEIVED", status: 409 });
        }
      }
      await tx.orm.public.SupplierBill.where({ id }).update({ status: "APPROVED", approvedBy: actorId, approvedAt: now });
    } else {
      if (locked.status === "CANCELLED") throw new AppError("This bill is already cancelled.", { code: "BILL_STATUS_CONFLICT", status: 409 });
      if (locked.status === "APPROVED") {
        if (compareMoney(await paidOn(tx, id), "0") > 0) throw new AppError("Void the payments on this bill before cancelling it.", { code: "BILL_HAS_PAYMENTS", status: 409 });
        for (const line of lines.filter((item) => item.purchaseOrderLineId)) {
          await tx.query(db.raw.sql`update erp_purchase_order_lines set "billedQuantity" = "billedQuantity" - ${dec(line.quantity)}::numeric where id = ${line.purchaseOrderLineId!}::uuid returning id::text as id`.returnsRow({ id: "pg/text@1" }).build());
        }
      }
      await tx.orm.public.SupplierBill.where({ id }).update({ status: "CANCELLED", cancelledBy: actorId, cancelledAt: now, cancelReason: reason });
    }
    await recordAuditEvent({ actorId, action: `SUPPLIER_BILL_${action === "approve" ? "APPROVED" : "CANCELLED"}`, entityType: "SupplierBill", entityId: id, metadata: { reason: reason || null } }, tx);
  });
  return getBill(id);
}

export async function getBill(id: string, asOf = today()) {
  if (!UUID.test(id)) notFound("Bill", "BILL_NOT_FOUND");
  const bill = await db.orm.public.SupplierBill.where({ id }).first();
  if (!bill) notFound("Bill", "BILL_NOT_FOUND");
  const lines = await db.orm.public.SupplierBillLine.where({ billId: id }).orderBy((line) => line.lineNo.asc()).all();
  const poLines = lines.some((line) => line.purchaseOrderLineId)
    ? await db.orm.public.PurchaseOrderLine.where((line) => line.id.in(lines.map((item) => item.purchaseOrderLineId).filter(Boolean) as string[])).all()
    : [];
  const supplier = await db.orm.public.Supplier.where({ id: bill.supplierId }).first();
  const order = bill.purchaseOrderId ? await db.orm.public.PurchaseOrder.where({ id: bill.purchaseOrderId }).first() : null;
  const payments = await db.orm.public.SupplierPayment.where({ billId: id }).orderBy((row) => row.createdAt.asc()).all();
  const paid = payments.filter((payment) => payment.status === "POSTED").reduce((sum, payment) => addMoney(sum, cash(payment.amount)), "0.00");
  const total = cash(bill.totalAmount);
  const outstanding = bill.status === "APPROVED" ? money(subtractDecimalStrings(total, paid)) : "0.00";
  return {
    ...bill,
    subtotal: cash(bill.subtotal), discountTotal: cash(bill.discountTotal), taxTotal: cash(bill.taxTotal), totalAmount: total,
    paidAmount: paid, outstandingAmount: outstanding,
    paymentStatus: bill.status !== "APPROVED" ? null : compareMoney(outstanding, "0") <= 0 ? "PAID" : compareMoney(paid, "0") > 0 ? "PARTIALLY_PAID" : "UNPAID",
    daysOverdue: bill.status === "APPROVED" && compareMoney(outstanding, "0") > 0 ? daysOverdue(bill.dueDate, asOf) : 0,
    supplierName: supplier?.name ?? null, supplierCode: supplier?.code ?? null,
    poNumber: order?.poNumber ?? null,
    lines: lines.map((line) => {
      const poLine = poLines.find((item) => item.id === line.purchaseOrderLineId);
      return {
        ...line,
        quantity: dec(line.quantity), unitPrice: dec(line.unitPrice),
        grossAmount: cash(line.grossAmount), discountAmount: cash(line.discountAmount), taxAmount: cash(line.taxAmount), lineTotal: cash(line.lineTotal),
        // Three-way match: ordered, received, already billed and the PO price.
        match: poLine ? {
          ordered: dec(poLine.quantity), received: dec(poLine.receivedQuantity), billed: dec(poLine.billedQuantity), poUnitPrice: dec(poLine.unitPrice),
          priceOk: compareDecimalStrings(dec(line.unitPrice), dec(poLine.unitPrice)) <= 0,
        } : null,
      };
    }),
    payments: payments.map((payment) => ({ ...payment, amount: cash(payment.amount) })),
  };
}

export async function listBills(filters: ListQuery, asOf = today()) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select b.id::text as id, b."billNumber", b."supplierInvoiceNumber", b."billDate", b."dueDate", b.status, b."totalAmount"::text as "totalAmount",
      s.name as "supplierName", s.id::text as "supplierId", coalesce(o."poNumber", '') as "poNumber",
      (select coalesce(sum(amount), 0) from erp_supplier_payments p where p."billId" = b.id and p.status = 'POSTED')::text as paid
    from erp_supplier_bills b join erp_suppliers s on s.id = b."supplierId" left join erp_purchase_orders o on o.id = b."purchaseOrderId"
    where (${filters.status} = '' or b.status = ${filters.status}
        or (${filters.status} = 'OPEN' and b.status = 'APPROVED' and b."totalAmount" > (select coalesce(sum(amount), 0) from erp_supplier_payments p where p."billId" = b.id and p.status = 'POSTED')))
      and (${filters.supplierId ?? ""} = '' or s.id::text = ${filters.supplierId ?? ""})
      and (${filters.search} = '' or b."billNumber" ilike ${pattern} or b."supplierInvoiceNumber" ilike ${pattern} or s.name ilike ${pattern})
    order by b."createdAt" desc, b.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", billNumber: "pg/text@1", supplierInvoiceNumber: "pg/text@1", billDate: "pg/text@1", dueDate: "pg/text@1", status: "pg/text@1", totalAmount: "pg/text@1", supplierName: "pg/text@1", supplierId: "pg/text@1", poNumber: "pg/text@1", paid: "pg/text@1" }).build());
  return {
    bills: result.slice(0, filters.pageSize).map((row) => {
      const outstanding = row.status === "APPROVED" ? money(subtractDecimalStrings(cash(row.totalAmount), cash(row.paid))) : "0.00";
      return { ...row, totalAmount: cash(row.totalAmount), paidAmount: cash(row.paid), outstandingAmount: outstanding, poNumber: row.poNumber || null, daysOverdue: compareMoney(outstanding, "0") > 0 ? daysOverdue(row.dueDate, asOf) : 0 };
    }),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}

/* Approved bills with a balance, received-not-billed PO lines, by supplier and age. */
export async function getPayables(asOf = today()) {
  const open = await rows<{ supplierId: string; supplierName: string; dueDate: string; outstanding: string }>(db.runtime(), db.raw.sql`
    select b."supplierId"::text as "supplierId", s.name as "supplierName", b."dueDate",
      (b."totalAmount" - coalesce(p.total, 0))::text as outstanding
    from erp_supplier_bills b join erp_suppliers s on s.id = b."supplierId"
    left join (select "billId", sum(amount) as total from erp_supplier_payments where status = 'POSTED' group by "billId") p on p."billId" = b.id
    where b.status = 'APPROVED' and b."totalAmount" - coalesce(p.total, 0) > 0
  `.returnsRow({ supplierId: "pg/text@1", supplierName: "pg/text@1", dueDate: "pg/text@1", outstanding: "pg/text@1" }).build());
  const [unbilled] = await rows<{ value: string; lines: string }>(db.runtime(), db.raw.sql`
    select coalesce(sum(round(("receivedQuantity" - "billedQuantity") * "unitPrice" * (100 - "discountPercent") / 100 * (100 + "taxPercent") / 100, 2)), 0)::text as value,
      count(*)::text as lines
    from erp_purchase_order_lines l join erp_purchase_orders o on o.id = l."purchaseOrderId"
    where o.status <> 'CANCELLED' and l."receivedQuantity" > l."billedQuantity"
  `.returnsRow({ value: "pg/text@1", lines: "pg/text@1" }).build());

  const empty = () => Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket, "0.00"])) as Record<(typeof AGING_BUCKETS)[number], string>;
  const suppliers = new Map<string, { supplierId: string; supplierName: string; bills: number; total: string; buckets: ReturnType<typeof empty> }>();
  const totals = { bills: 0, total: "0.00", buckets: empty() };
  for (const row of open) {
    const bucket = agingBucket(row.dueDate, asOf);
    const amount = cash(row.outstanding);
    const entry = suppliers.get(row.supplierId) ?? { supplierId: row.supplierId, supplierName: row.supplierName, bills: 0, total: "0.00", buckets: empty() };
    entry.bills += 1;
    entry.total = addMoney(entry.total, amount);
    entry.buckets[bucket] = addMoney(entry.buckets[bucket], amount);
    suppliers.set(row.supplierId, entry);
    totals.bills += 1;
    totals.total = addMoney(totals.total, amount);
    totals.buckets[bucket] = addMoney(totals.buckets[bucket], amount);
  }
  const overdue = AGING_BUCKETS.filter((bucket) => bucket !== "current").reduce((sum, bucket) => addMoney(sum, totals.buckets[bucket]), "0.00");
  return {
    asOf, buckets: AGING_BUCKETS, totals, overdue,
    // Estimate at PO prices; it becomes exact once the supplier bills it.
    receivedNotBilled: { value: cash(unbilled.value), lines: Number(unbilled.lines) },
    suppliers: [...suppliers.values()].sort((a, b) => compareMoney(b.total, a.total) || a.supplierName.localeCompare(b.supplierName)),
  };
}

export async function recordSupplierPayment(input: SupplierPaymentInput, actorId: string) {
  const replay = await db.orm.public.SupplierPayment.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getSupplierPayment(replay.id);
  const amount = money(toPlainDecimalString(input.amount));
  try {
    const id = await db.transaction(async (tx) => {
      const [bill] = await rows<{ status: string; total: string; supplierId: string; billNumber: string }>(tx, db.raw.sql`
        select status, "totalAmount"::text as total, "supplierId"::text as "supplierId", "billNumber" from erp_supplier_bills where id = ${input.billId}::uuid for update
      `.returnsRow({ status: "pg/text@1", total: "pg/text@1", supplierId: "pg/text@1", billNumber: "pg/text@1" }).build());
      if (!bill) throw new AppError("Bill not found.", { code: "BILL_NOT_FOUND", status: 404 });
      if (bill.status !== "APPROVED") throw new AppError("Payments can only be recorded against approved bills.", { code: "BILL_NOT_APPROVED", status: 409 });
      const outstanding = money(subtractDecimalStrings(cash(bill.total), await paidOn(tx, input.billId)));
      if (compareMoney(amount, outstanding) > 0) {
        throw new AppError(`Only ${outstanding} is outstanding on ${bill.billNumber}.`, { code: "PAYMENT_EXCEEDS_OUTSTANDING", status: 409, details: { outstanding } });
      }
      const paymentNumber = await allocateDocumentNumber(tx, "PAY");
      const payment = await tx.orm.public.SupplierPayment.create({
        paymentNumber, billId: input.billId, supplierId: bill.supplierId, paymentDate: input.paymentDate, method: input.method,
        reference: input.reference || null, amount, notes: input.notes || null, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      await recordAuditEvent({ actorId, action: "SUPPLIER_PAYMENT_POSTED", entityType: "SupplierPayment", entityId: payment.id, metadata: { paymentNumber, billId: input.billId, amount } }, tx);
      return payment.id;
    });
    return getSupplierPayment(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.SupplierPayment.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getSupplierPayment(original.id);
    }
    throw error;
  }
}

export async function voidSupplierPayment(id: string, reason: string, actorId: string) {
  if (!UUID.test(id)) notFound("Payment", "PAYMENT_NOT_FOUND");
  await db.transaction(async (tx) => {
    const updated = await rows<{ paymentNumber: string }>(tx, db.raw.sql`
      update erp_supplier_payments set status = 'VOIDED', "voidedBy" = ${actorId}::uuid, "voidedAt" = now(), "voidReason" = ${reason}
      where id = ${id}::uuid and status = 'POSTED' returning "paymentNumber"
    `.returnsRow({ paymentNumber: "pg/text@1" }).build());
    if (!updated.length) {
      if (!(await tx.orm.public.SupplierPayment.where({ id }).first())) notFound("Payment", "PAYMENT_NOT_FOUND");
      throw new AppError("This payment is already voided.", { code: "PAYMENT_STATUS_CONFLICT", status: 409 });
    }
    await recordAuditEvent({ actorId, action: "SUPPLIER_PAYMENT_VOIDED", entityType: "SupplierPayment", entityId: id, metadata: { paymentNumber: updated[0].paymentNumber, reason } }, tx);
  });
  return getSupplierPayment(id);
}

export async function getSupplierPayment(id: string) {
  if (!UUID.test(id)) notFound("Payment", "PAYMENT_NOT_FOUND");
  const payment = await db.orm.public.SupplierPayment.where({ id }).first();
  if (!payment) notFound("Payment", "PAYMENT_NOT_FOUND");
  const bill = await db.orm.public.SupplierBill.where({ id: payment.billId }).first();
  const supplier = await db.orm.public.Supplier.where({ id: payment.supplierId }).first();
  return { ...payment, amount: cash(payment.amount), billNumber: bill?.billNumber ?? null, supplierInvoiceNumber: bill?.supplierInvoiceNumber ?? null, supplierName: supplier?.name ?? null };
}

export async function listSupplierPayments(filters: ListQuery) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select p.id::text as id, p."paymentNumber", p."paymentDate", p.method, coalesce(p.reference, '') as reference, p.amount::text as amount, p.status,
      b.id::text as "billId", b."billNumber", s.name as "supplierName"
    from erp_supplier_payments p join erp_supplier_bills b on b.id = p."billId" join erp_suppliers s on s.id = p."supplierId"
    where (${filters.status} = '' or p.status = ${filters.status})
      and (${filters.supplierId ?? ""} = '' or s.id::text = ${filters.supplierId ?? ""})
      and (${filters.search} = '' or p."paymentNumber" ilike ${pattern} or b."billNumber" ilike ${pattern} or s.name ilike ${pattern} or p.reference ilike ${pattern})
    order by p."createdAt" desc, p.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", paymentNumber: "pg/text@1", paymentDate: "pg/text@1", method: "pg/text@1", reference: "pg/text@1", amount: "pg/text@1", status: "pg/text@1", billId: "pg/text@1", billNumber: "pg/text@1", supplierName: "pg/text@1" }).build());
  return {
    payments: result.slice(0, filters.pageSize).map((row) => ({ ...row, amount: cash(row.amount) })),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}
