import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { createDepartment, createEmployee, saveAttendance } from "../../server/payroll/hr.service.ts";
import { attendanceSaveSchema, employeeInputSchema } from "../../server/payroll/hr.validation.ts";
import { changeLeaveRequest, createLeaveRequest, createLeaveType, createShift, getLeaveBalances, listShifts, shiftMinutes } from "../../server/payroll/leave.service.ts";
import { leaveRequestInputSchema } from "../../server/payroll/leave.validation.ts";
import { archiveDocument, bulkAdjustPrices, changePrice, createCategory, getDocumentContent, listCategories, listPriceChanges, updateCategory, uploadDocument } from "../../server/products/catalogue.service.ts";
import { createProduct, updateProduct } from "../../server/products/product.service.ts";
import { changeCapa, changeNcr, createCapa, createNcr, getNcr, updateNcr } from "../../server/quality/ncr.service.ts";
import { capaInputSchema, ncrInputSchema } from "../../server/quality/ncr.validation.ts";

const run = `Z${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const key = () => randomUUID();
const ctx = {};
// A unique far-future year per run (calendar dates and payroll months are global).
const year = 2100 + (Date.now() % 700);
const day = (month, n) => `${year}-${String(month).padStart(2, "0")}-${String(n).padStart(2, "0")}`;

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test.before(async () => {
  ctx.item = await createProduct({ sku: `NCR-${run}`, name: `Slider ${run}`, category: `Cat ${run}`, productType: "Finished Good", unit: "Pcs", unitPrice: 0.335, status: "ACTIVE", minimumStock: 0 }, actor);
  ctx.item2 = await createProduct({ sku: `NCR2-${run}`, name: `Slider ${run}`, category: `Cat ${run}`, productType: "Finished Good", unit: "Pcs", unitPrice: 1.1, status: "ACTIVE", minimumStock: 0 }, actor);
  ctx.department = await createDepartment({ code: `Z-${run}`.slice(0, 20), name: `Assembly ${run}` }, actor);
  ctx.employee = await createEmployee(employeeInputSchema.parse({ employeeCode: `E-${run}`, name: `Worker ${run}`, departmentId: ctx.department.id, designation: "Operator", employmentType: "PERMANENT", joinDate: "2000-01-01" }), actor);
});

test("NCR: closes only with root cause, disposition and every action verified", async () => {
  const input = ncrInputSchema.parse({ source: "IN_PROCESS", severity: "MAJOR", title: "Teeth misaligned", description: "Batch shows misaligned teeth", productId: ctx.item.id, quantityAffected: 1200, idempotencyKey: key() });
  const [ncr, replay] = await Promise.all([createNcr(input, actor), createNcr(input, actor)]);
  assert.equal(ncr.id, replay.id);
  assert.equal(ncr.links.product.startsWith(`NCR-${run}`), true);
  await expectCode(changeNcr(ncr.id, "close", "", actor), "NCR_INCOMPLETE");

  const capa = await createCapa(capaInputSchema.parse({ ncrId: ncr.id, actionType: "CORRECTIVE", title: "Re-set die", action: "Re-set teeth die and check first-off", ownerName: "Shift lead", dueDate: "2000-01-01", idempotencyKey: key() }), actor);
  assert.equal(capa.overdue, true, "past due and open");
  await changeNcr(ncr.id, "investigate", "", actor);
  await updateNcr(ncr.id, { rootCause: "Die worn", disposition: "REWORK", containment: "Held" }, actor);
  await expectCode(changeNcr(ncr.id, "close", "", actor), "NCR_CAPA_OPEN");
  await expectCode(changeNcr(ncr.id, "cancel", "dup", actor), "NCR_CAPA_OPEN");

  await expectCode(changeCapa(capa.id, "verify", "x", actor), "CAPA_STATUS_CONFLICT");
  await changeCapa(capa.id, "start", "", actor);
  await changeCapa(capa.id, "complete", "Die re-set", actor);
  await changeCapa(capa.id, "reopen", "Still misaligned", actor);
  await changeCapa(capa.id, "complete", "Die replaced", actor);
  const verified = await changeCapa(capa.id, "verify", "Three lots passed", actor);
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.overdue, false);

  const closed = await changeNcr(ncr.id, "close", "Effective", actor);
  assert.equal(closed.status, "CLOSED");
  await expectCode(updateNcr(ncr.id, { rootCause: "changed" }, actor), "NCR_STATUS_CONFLICT");
  await expectCode(createCapa(capaInputSchema.parse({ ncrId: ncr.id, actionType: "PREVENTIVE", title: "Late", action: "Too late", ownerName: "QA", dueDate: day(1, 1), idempotencyKey: key() }), actor), "NCR_STATUS_CONFLICT");
  assert.equal((await getNcr(ncr.id)).capas.length, 1);
});

test("shifts: paid minutes include overnight wrap; codes are unique", async () => {
  assert.equal(shiftMinutes("22:00", "06:00", 30), 450);
  assert.equal(shiftMinutes("08:00", "17:00", 60), 480);
  await createShift({ code: `N${run}`.slice(0, 12), name: "Night", startTime: "22:00", endTime: "06:00", breakMinutes: 30 }, actor);
  await expectCode(createShift({ code: `N${run}`.slice(0, 12), name: "Again", startTime: "08:00", endTime: "16:00", breakMinutes: 0 }, actor), "SHIFT_EXISTS");
  const night = (await listShifts()).find((shift) => shift.code === `N${run}`.slice(0, 12));
  assert.equal(night.overnight, true);
  assert.equal(night.paidMinutes, 450);
});

test("leave: holidays are not counted; approval writes attendance; overlap, balance and conflicts are refused", async () => {
  ctx.annual = await createLeaveType({ code: `A${run}`.slice(0, 12), name: `Annual ${run}`, paid: true, annualDays: 3 }, actor);
  await db.orm.public.CalendarDay.create({ date: day(3, 4), dayType: "HOLIDAY", note: "Test holiday", createdBy: actor });
  const request = (from, to, extra = {}) => createLeaveRequest(leaveRequestInputSchema.parse({ employeeId: ctx.employee.id, leaveTypeId: ctx.annual.id, fromDate: from, toDate: to, reason: "Family", idempotencyKey: key(), ...extra }), actor);

  const first = await request(day(3, 3), day(3, 5));
  assert.equal(first.days, "2", "the holiday on the 4th is not counted");
  await expectCode(request(day(3, 5), day(3, 6)), "LEAVE_OVERLAP");
  await changeLeaveRequest(first.id, "approve", "", actor);
  const attendance = await db.orm.public.AttendanceRecord.where({ employeeId: ctx.employee.id }).all();
  assert.deepEqual(attendance.filter((row) => row.date.startsWith(`${year}-03`)).map((row) => [row.date, row.status]).sort(), [[day(3, 3), "PAID_LEAVE"], [day(3, 5), "PAID_LEAVE"]]);

  const second = await request(day(3, 10), day(3, 11));
  await expectCode(changeLeaveRequest(second.id, "approve", "", actor), "LEAVE_BALANCE_EXCEEDED");
  await changeLeaveRequest(second.id, "reject", "Busy season", actor);

  await saveAttendance(attendanceSaveSchema.parse({ date: day(3, 20), records: [{ employeeId: ctx.employee.id, status: "PRESENT" }] }), actor);
  const third = await request(day(3, 20), day(3, 20));
  await expectCode(changeLeaveRequest(third.id, "approve", "", actor), "LEAVE_ATTENDANCE_CONFLICT");

  const balances = await getLeaveBalances(year);
  const mine = balances.employees.find((row) => row.id === ctx.employee.id).balances.find((row) => row.leaveTypeId === ctx.annual.id);
  assert.deepEqual([mine.used, mine.pending, mine.remaining], ["2", "1", "1"]);

  await changeLeaveRequest(first.id, "cancel", "Plans changed", actor);
  const after = await db.orm.public.AttendanceRecord.where({ employeeId: ctx.employee.id }).all();
  assert.equal(after.some((row) => row.date === day(3, 3) || row.date === day(3, 5)), false, "cancelling removes the leave it wrote");
  await expectCode(changeLeaveRequest(first.id, "approve", "", actor), "LEAVE_STATUS_CONFLICT");
});

test("categories rename everywhere; price changes keep exact history; bulk adjust rounds half up to 6 places", async () => {
  const category = await createCategory({ name: `Cat ${run}` }, actor);
  await expectCode(createCategory({ name: `Cat ${run}` }, actor), "CATEGORY_EXISTS");
  const renamed = await updateCategory(category.id, { name: `Sliders ${run}`, status: "ACTIVE" }, actor);
  assert.equal(renamed.productsRenamed, 2);
  assert.equal((await db.orm.public.Product.where({ id: ctx.item.id }).first()).category, `Sliders ${run}`);
  assert.equal((await listCategories()).find((row) => row.name === `Sliders ${run}`).products, 2);

  const change = await changePrice(ctx.item.id, { unitPrice: 0.3412345, effectiveDate: "2026-11-01", reason: "Zinc price" }, actor);
  assert.deepEqual([change.previous, change.next], ["0.335", "0.3412345"]);
  await expectCode(changePrice(ctx.item.id, { unitPrice: 0.3412345, effectiveDate: "2026-11-01", reason: "again" }, actor), "PRICE_UNCHANGED");

  // 0.3412345 × 1.10 = 0.37535795 -> 0.375358; 1.1 × 1.10 = 1.21.
  const preview = await bulkAdjustPrices({ category: `Sliders ${run}`, percent: 10, effectiveDate: "2026-11-02", reason: "Annual", apply: false }, actor);
  assert.deepEqual(preview.changes.map((row) => [row.sku, row.proposed]).sort(), [[`NCR-${run}`, "0.375358"], [`NCR2-${run}`, "1.21"]]);
  assert.equal(String((await db.orm.public.Product.where({ id: ctx.item.id }).first()).unitPrice).startsWith("0.3412345"), true, "preview changes nothing");
  await bulkAdjustPrices({ category: `Sliders ${run}`, percent: 10, effectiveDate: "2026-11-02", reason: "Annual", apply: true }, actor);

  const product = await db.orm.public.Product.where({ id: ctx.item2.id }).first();
  await updateProduct(ctx.item2.id, { sku: product.sku, name: product.name, category: product.category, productType: product.productType, unit: product.unit, unitPrice: 1.25, status: "ACTIVE", minimumStock: 0 }, actor);
  const history = await listPriceChanges({ productId: ctx.item2.id, page: 1, pageSize: 10 });
  assert.deepEqual(history.changes.map((row) => [row.previousPrice, row.newPrice, row.reason]), [["1.21", "1.25", "Edited on the item form"], ["1.1", "1.21", "Annual"]]);
});

test("documents: type must match the bytes, size is limited, content round-trips with its checksum, archive keeps it", async () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\n% test document\n%%EOF\n");
  const upload = (extra) => uploadDocument({ productId: ctx.item.id, title: "Spec sheet", documentType: "SPECIFICATION", fileName: "spec.pdf", mimeType: "application/pdf", content: pdf, ...extra }, actor);
  await expectCode(upload({ content: new TextEncoder().encode("<html><script>alert(1)</script>") }), "DOCUMENT_CONTENT_MISMATCH");
  await expectCode(upload({ mimeType: "text/html" }), "DOCUMENT_TYPE_NOT_ALLOWED");
  await expectCode(upload({ content: new Uint8Array(5 * 1024 * 1024 + 1).fill(0x25) }), "DOCUMENT_TOO_LARGE");

  const saved = await upload({ fileName: "../../etc/spec \"v1\".pdf" });
  assert.equal("content" in saved, false, "metadata only");
  assert.equal(saved.fileName.includes("/"), false);
  const stored = await getDocumentContent(saved.id);
  assert.deepEqual(Array.from(stored.content), Array.from(pdf));
  assert.equal(stored.sha256, createHash("sha256").update(pdf).digest("hex"));
  await archiveDocument(saved.id, actor);
  await expectCode(archiveDocument(saved.id, actor), "DOCUMENT_STATUS_CONFLICT");
  assert.equal((await getDocumentContent(saved.id)).status, "ARCHIVED");
});

/* ------------------------------------------------------------------ */
/* Planning, packing instructions, batches, settings                    */
/* ------------------------------------------------------------------ */

test("settings: validated, audited, with honest defaults", async () => {
  const { getSetting, setSetting } = await import("../../server/settings/settings.service.ts");
  await expectCode(setSetting("nope", {}, actor), "SETTING_NOT_FOUND");
  await expectCode(setSetting("company.profile", { name: "X", email: "not-an-email" }, actor), "VALIDATION_FAILED");
  const saved = await setSetting("planning.weeklyOff", { days: [5, 0, 0] }, actor);
  assert.deepEqual(saved.days, [0, 5], "deduplicated and sorted");
  assert.equal(saved.configured, true);
  assert.equal((await getSetting("company.profile")).name.length > 0, true);
});

test("calendar and capacity: holidays and weekly off are not working days; load is compared only in the capacity unit", async () => {
  const { workingDays, setCalendarDay, clearCalendarDay, saveWorkCenter, getCapacityLoad } = await import("../../server/planning/scheduling.service.ts");
  const { setSetting } = await import("../../server/settings/settings.service.ts");
  await setSetting("planning.weeklyOff", { days: [0] }, actor);
  // A week in the run's year; find its Sunday-free count first.
  const start = day(5, 1);
  const end = day(5, 7);
  const before = (await workingDays(start, end)).length;
  assert.equal(before, 6, "one Sunday in any 7 days");
  await setCalendarDay({ date: day(5, 2), dayType: (new Date(`${day(5, 2)}T00:00:00Z`).getUTCDay() === 0 ? "WORKING" : "HOLIDAY"), note: "test" }, actor);
  const after = (await workingDays(start, end)).length;
  assert.notEqual(after, before);
  await clearCalendarDay(day(5, 2), actor);
  assert.equal((await workingDays(start, end)).length, before);
  await expectCode(clearCalendarDay(day(5, 2), actor), "CALENDAR_DAY_NOT_FOUND");

  await expectCode(saveWorkCenter("no-such-stage", { name: "x", dailyCapacity: 1, capacityUnit: "Pcs", shiftsPerDay: 1 }, actor), "STAGE_NOT_FOUND");
  const center = await saveWorkCenter("assembling", { name: "Assembly line", dailyCapacity: 50000, capacityUnit: "Pcs", shiftsPerDay: 2 }, actor);
  assert.equal(center.dailyCapacity, "50000");
  const load = await getCapacityLoad(30);
  const assembling = load.stages.find((row) => row.stageKey === "assembling");
  assert.equal(assembling.perDayCapacity, "100000");
  for (const entry of assembling.load) assert.ok(entry.unit === "Pcs" || assembling.otherUnits.includes(entry.unit), "other units are listed, never added");
});

test("production plans: draft edits, approval, one release per line (concurrently), close cancels the rest", async () => {
  const { createPlan, updatePlanLines, changePlan, releasePlanLine, getPlan } = await import("../../server/planning/scheduling.service.ts");
  const line = (quantity, dueDate) => ({ productId: ctx.item.id, quantity, dueDate, priority: "NORMAL" });
  await expectCode(createPlan({ title: "Bad", periodStart: day(6, 1), periodEnd: day(6, 30), lines: [line(1000, day(7, 1))], idempotencyKey: key() }, actor), "PLAN_LINE_OUTSIDE_PERIOD");
  await expectCode(createPlan({ title: "Bad", periodStart: day(6, 1), periodEnd: day(6, 30), lines: [line(10.5, day(6, 10))], idempotencyKey: key() }, actor), "QUANTITY_PRECISION");
  const planKey = key();
  const plan = await createPlan({ title: `June ${run}`, periodStart: day(6, 1), periodEnd: day(6, 30), lines: [line(1000, day(6, 10))], idempotencyKey: planKey }, actor);
  assert.equal((await createPlan({ title: "again", periodStart: day(6, 1), periodEnd: day(6, 30), lines: [], idempotencyKey: planKey }, actor)).id, plan.id);
  await updatePlanLines(plan.id, { title: plan.title, periodStart: day(6, 1), periodEnd: day(6, 30), lines: [line(1000, day(6, 10)), line(500, day(6, 20))] }, actor);
  let current = await getPlan(plan.id);
  await expectCode(releasePlanLine(plan.id, current.lines[0].id, actor), "PLAN_STATUS_CONFLICT");
  await changePlan(plan.id, "approve", actor);
  await expectCode(updatePlanLines(plan.id, { title: "x", periodStart: day(6, 1), periodEnd: day(6, 30), lines: [] }, actor), "PLAN_NOT_EDITABLE");

  const outcomes = await Promise.allSettled([1, 2, 3].map(() => releasePlanLine(plan.id, current.lines[0].id, actor)));
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1, "a line becomes one production order");
  current = await getPlan(plan.id);
  const released = current.lines[0];
  assert.equal(released.status, "RELEASED");
  const order = await db.orm.public.ProductionOrder.where({ id: released.productionOrderId }).first();
  assert.deepEqual([String(order.quantity), order.dueDate, order.productId], ["1000", day(6, 10), ctx.item.id]);
  assert.equal((await db.orm.public.ProductionStage.where({ productionOrderId: order.id }).all()).length, 9, "with its nine stages");

  await changePlan(plan.id, "close", actor);
  current = await getPlan(plan.id);
  assert.deepEqual(current.lines.map((row) => row.status), ["RELEASED", "CANCELLED"]);
  await expectCode(changePlan(plan.id, "approve", actor), "PLAN_STATUS_CONFLICT");
});

test("packing instructions: one active per item and customer; customer-specific wins over default", async () => {
  const { createInstruction, updateInstruction, resolveInstruction } = await import("../../server/packing/instructions.service.ts");
  const { createCustomer } = await import("../../server/sales/sales.service.ts");
  const customer = await createCustomer({ code: `PK-${run}`, name: `Packing customer ${run}` }, actor);
  const base = { productId: ctx.item.id, packType: "Polybag", unitsPerPack: 100, packsPerCarton: 20 };
  await expectCode(createInstruction({ ...base, unitsPerPack: 12.5 }, actor), "QUANTITY_PRECISION");
  const fallback = await createInstruction(base, actor);
  assert.equal(fallback.unitsPerCarton, "2000");
  await expectCode(createInstruction(base, actor), "PACKING_INSTRUCTION_EXISTS");
  const special = await createInstruction({ ...base, customerId: customer.id, packType: "Box", unitsPerPack: 50 }, actor);
  assert.equal((await resolveInstruction(ctx.item.id, customer.id)).id, special.id);
  assert.equal((await resolveInstruction(ctx.item.id, randomUUID())).id, fallback.id);
  await updateInstruction(special.id, { packType: "Box", unitsPerPack: 50, packsPerCarton: 10, status: "INACTIVE" }, actor);
  assert.equal((await resolveInstruction(ctx.item.id, customer.id)).id, fallback.id, "inactive falls back to the default");
});

test("batches: never exceed the source quantity; status moves are one-way; trace links the order", async () => {
  const { createBatch, setBatchStatus, getBatch } = await import("../../server/inventory/batches.service.ts");
  const { createProductionOrder } = await import("../../server/production/production.service.ts");
  const order = await createProductionOrder({ productId: ctx.item.id, quantity: 1000, priority: "NORMAL" }, actor);
  const batch = (quantity, extra = {}) => createBatch({ productId: ctx.item.id, sourceType: "PRODUCTION", productionOrderId: order.id, quantity, madeOn: day(8, 1), ...extra }, actor);
  await expectCode(batch(600, { productId: ctx.item2.id }), "BATCH_SOURCE_MISMATCH");
  await expectCode(batch(600, { expiresOn: day(7, 1) }), "BATCH_DATES_INVALID");
  const outcomes = await Promise.allSettled([batch(600), batch(600)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1, "two 600 batches cannot both fit a 1000 order");
  await expectCode(batch(401), "BATCH_EXCEEDS_SOURCE");
  const second = await batch(400);
  assert.match(second.batchNumber, /^LOT-/);
  assert.equal(second.trace.productionOrderNumber, order.orderNumber);

  await setBatchStatus(second.id, "ON_HOLD", "pending QC", actor);
  await setBatchStatus(second.id, "REJECTED", "failed", actor);
  await expectCode(setBatchStatus(second.id, "RELEASED", "", actor), "BATCH_STATUS_CONFLICT");
  // A rejected batch no longer counts against the source.
  const third = await batch(400);
  assert.equal((await getBatch(third.id)).status, "ACTIVE");
});
