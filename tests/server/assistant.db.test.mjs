import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { executeTool, runAssistant, toolsFor } from "../../server/assistant/assistant.service.ts";
import { listCashTransactions, recordCashTransaction } from "../../server/ledger/ledger.service.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { createCustomer, createSalesOrder, getSalesOrder } from "../../server/sales/sales.service.ts";
import { cashQuerySchema, cashTransactionInputSchema } from "../../server/ledger/ledger.validation.ts";
import { customerInputSchema, salesOrderInputSchema } from "../../server/sales/sales.validation.ts";

const run = `AI${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};
const everything = { id: actor, name: "Tester", permissions: ["customers:view", "customers:create", "products:view", "sales:view", "sales:create", "finance:view", "finance:create"] };
const viewer = { id: randomUUID(), name: "Viewer", permissions: ["dashboard:view", "reports:view"] };

test.before(async () => {
  ctx.product = await createProduct({ sku: `SLI-5-BR-${run}`, name: `#5 Brass slider ${run}`, category: "Sliders", productType: "Finished Good", unit: "Pcs", unitPrice: 12, status: "ACTIVE", minimumStock: 0 }, actor);
  ctx.customer = await createCustomer(customerInputSchema.parse({ code: `C-${run}`, name: `Ali Traders ${run}`, email: "", phone: "" }), actor);
});

test("tools follow the user's permissions, and a refused tool says so", async () => {
  assert.deepEqual(toolsFor(viewer).map((tool) => tool.name), []);
  const names = toolsFor(everything).map((tool) => tool.name);
  for (const name of ["find_customers", "find_products", "propose_sales_order", "propose_cash_entry"]) assert.ok(names.includes(name), name);
  assert.ok(!names.includes("propose_leave_request"));
  const refused = await executeTool("find_customers", { search: "" }, viewer);
  assert.match(refused.error, /does not allow/);
  await assert.rejects(runAssistant(viewer, [], "hello", "2026-10-16"), (error) => error.code === "FORBIDDEN");
});

test("lookups return real records", async () => {
  const customers = await executeTool("find_customers", { search: run }, everything);
  assert.deepEqual(customers.result.map((row) => row.id), [ctx.customer.id]);
  const products = await executeTool("find_products", { search: run }, everything);
  assert.equal(products.result[0].id, ctx.product.id);
  assert.equal(products.result[0].sku, `SLI-5-BR-${run}`);
});

test("a sales order proposal is the route's exact body and creates a draft when confirmed", async () => {
  const { proposal, error } = await executeTool("propose_sales_order", {
    customerId: ctx.customer.id, orderDate: "2026-10-16", deliveryDate: "2026-10-30", notes: "",
    lines: [
      { kind: "catalog", productId: ctx.product.id, productName: "", unit: "", quantity: 5000, unitPrice: 12, discountPercent: 0, taxPercent: 0, notes: "" },
      { kind: "custom", productId: "", productName: "Special pull tab", unit: "Pcs", quantity: 100, unitPrice: 3.5, discountPercent: 0, taxPercent: 0, notes: "" },
    ],
  }, everything);
  assert.equal(error, undefined);
  assert.equal(proposal.endpoint, "/api/sales/orders");
  assert.equal(proposal.permission, "sales:create");
  assert.ok(proposal.summary.some(([label]) => label.includes(`SLI-5-BR-${run}`)));
  // What the browser posts on Confirm passes the route's schema and the real service.
  const parsed = salesOrderInputSchema.safeParse(proposal.body);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
  const order = await createSalesOrder(parsed.data, actor);
  const saved = await getSalesOrder(order.id);
  assert.equal(saved.status, "DRAFT");
  assert.equal(saved.lines.length, 2);
});

test("invalid proposals come back as errors the model can fix, never as entries", async () => {
  const badProduct = await executeTool("propose_sales_order", {
    customerId: ctx.customer.id, orderDate: "2026-10-16", deliveryDate: "", notes: "",
    lines: [{ kind: "catalog", productId: randomUUID(), productName: "", unit: "", quantity: 10, unitPrice: 1, discountPercent: 0, taxPercent: 0, notes: "" }],
  }, everything);
  assert.match(badProduct.error, /was not found/);
  assert.equal(badProduct.proposal, undefined);

  const badDates = await executeTool("propose_sales_order", {
    customerId: ctx.customer.id, orderDate: "2026-10-16", deliveryDate: "2026-10-01", notes: "",
    lines: [{ kind: "catalog", productId: ctx.product.id, productName: "", unit: "", quantity: 10, unitPrice: 1, discountPercent: 0, taxPercent: 0, notes: "" }],
  }, everything);
  assert.match(badDates.error, /Delivery date cannot be earlier/);

  const badCustomer = await executeTool("propose_customer", { code: "", name: "X", email: "not-an-email", phone: "" }, everything);
  assert.match(badCustomer.error, /Not valid/);
});

test("a cash entry proposal checks the accounts and is idempotent when confirmed twice", async () => {
  const accounts = (await executeTool("list_accounts", {}, everything)).result;
  const cash = accounts.find((account) => account.code === "1000");
  const expense = accounts.find((account) => account.code === "6900");
  const notCash = await executeTool("propose_cash_entry", { kind: "EXPENSE", transactionDate: "2026-10-16", cashAccountId: expense.id, counterAccountId: cash.id, amount: 18500, payee: "LESCO", reference: "", description: `Electricity ${run}` }, everything);
  assert.match(notCash.error, /cash or bank account/);

  const { proposal } = await executeTool("propose_cash_entry", { kind: "EXPENSE", transactionDate: "2026-10-16", cashAccountId: cash.id, counterAccountId: expense.id, amount: 18500, payee: "LESCO", reference: "", description: `Electricity ${run}` }, everything);
  assert.equal(proposal.endpoint, "/api/ledger/cash-transactions");
  const body = cashTransactionInputSchema.parse(proposal.body);
  const [first, second] = await Promise.all([recordCashTransaction(body, actor), recordCashTransaction(body, actor)]);
  assert.equal(first.id, second.id);
  const listed = await listCashTransactions(cashQuerySchema.parse({ kind: "EXPENSE", search: run }));
  assert.equal(listed.transactions.filter((row) => row.description === `Electricity ${run}`).length, 1);
});

test("without ANTHROPIC_API_KEY the assistant says it is not set up", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(runAssistant(everything, [], "Aaj 500 ka chai ka kharcha", "2026-10-16"), (error) => error.code === "ASSISTANT_NOT_CONFIGURED");
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("supplier, requisition and leave proposals carry bodies the real services accept", async () => {
  const { createDepartment, createEmployee } = await import("../../server/payroll/hr.service.ts");
  const { employeeInputSchema } = await import("../../server/payroll/hr.validation.ts");
  const { createLeaveRequest, createLeaveType } = await import("../../server/payroll/leave.service.ts");
  const { leaveRequestInputSchema } = await import("../../server/payroll/leave.validation.ts");
  const { createRequisition, createSupplier } = await import("../../server/procurement/procurement.service.ts");
  const { requisitionInputSchema, supplierInputSchema } = await import("../../server/procurement/procurement.validation.ts");
  const staff = { id: actor, name: "Tester", permissions: ["purchasing:view", "purchasing:create", "products:view", "hr:view", "hr:manage"] };

  const supplier = await executeTool("propose_supplier", { code: `S-${run}`.slice(0, 20), name: `Star Metals ${run}`, contactName: "", phone: "0300-1234567", email: "", address: "Lahore", taxRegistration: "", paymentTermsDays: 30, notes: "" }, staff);
  assert.equal(supplier.error, undefined);
  const savedSupplier = await createSupplier(supplierInputSchema.parse(supplier.proposal.body), actor);
  assert.equal(savedSupplier.name, `Star Metals ${run}`);

  const requisition = await executeTool("propose_purchase_requisition", { neededBy: "2026-11-01", notes: "", lines: [{ productId: ctx.product.id, quantity: 2000, notes: "" }] }, staff);
  assert.equal(requisition.error, undefined);
  const savedRequisition = await createRequisition(requisitionInputSchema.parse(requisition.proposal.body), actor);
  assert.equal(savedRequisition.status, "DRAFT");

  const department = await createDepartment({ code: `D-${run}`.slice(0, 20), name: `Assembly ${run}` }, actor);
  const employee = await createEmployee(employeeInputSchema.parse({ employeeCode: `E-${run}`, name: `Bilal ${run}`, departmentId: department.id, designation: "Operator", employmentType: "PERMANENT", joinDate: "2000-01-01" }), actor);
  const leaveType = await createLeaveType({ code: `CL${Date.now() % 10000}`, name: `Casual ${run}`, paid: true, annualDays: 10 }, actor);
  const found = await executeTool("find_employees", { search: `Bilal ${run}` }, staff);
  assert.equal(found.result[0].id, employee.id);
  const leave = await executeTool("propose_leave_request", { employeeId: employee.id, leaveTypeId: leaveType.id, fromDate: "2026-10-17", toDate: "2026-10-18", reason: "Family function" }, staff);
  assert.equal(leave.error, undefined);
  const savedLeave = await createLeaveRequest(leaveRequestInputSchema.parse(leave.proposal.body), actor);
  assert.equal(savedLeave.status, "PENDING");
});
