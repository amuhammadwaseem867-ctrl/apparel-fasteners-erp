import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createServer } from "node:http";

import { executeTool, runAssistant, toolsFor } from "../../server/assistant/assistant.service.ts";
import { GROQ_DEFAULT_MODEL, grokSettings } from "../../server/assistant/grok.ts";
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

// The assistant is off unless switched on; these tests exercise it switched on.
process.env.AI_ASSISTANT_ENABLED = "true";

test.before(async () => {
  ctx.product = await createProduct({ sku: `SLI-5-BR-${run}`, name: `#5 Brass slider ${run}`, category: "Sliders", productType: "Finished Good", unit: "Pcs", unitPrice: 12, status: "ACTIVE", minimumStock: 0 }, actor);
  ctx.customer = await createCustomer(customerInputSchema.parse({ code: `C-${run}`, name: `Ali Traders ${run}`, email: "", phone: "" }), actor);
});

test("tools follow the user's permissions, and a refused tool says so", async () => {
  // A report viewer may ask for reports, nothing else.
  assert.deepEqual(toolsFor(viewer).map((tool) => tool.name), ["show_report"]);
  const nobody = { id: randomUUID(), name: "Nobody", permissions: ["dashboard:view"] };
  assert.deepEqual(toolsFor(nobody), []);
  const names = toolsFor(everything).map((tool) => tool.name);
  for (const name of ["find_customers", "find_products", "propose_sales_order", "propose_cash_entry"]) assert.ok(names.includes(name), name);
  assert.ok(!names.includes("propose_leave_request"));
  const refused = await executeTool("find_customers", { search: "" }, viewer);
  assert.match(refused.error, /does not allow/);
  await assert.rejects(runAssistant(nobody, [], "hello", "2026-10-16"), (error) => error.code === "FORBIDDEN");
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

test("without an AI key the assistant says it is not set up", async () => {
  const saved = { xai: process.env.XAI_API_KEY, groq: process.env.GROQ_API_KEY };
  delete process.env.XAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    await assert.rejects(runAssistant(everything, [], "Aaj 500 ka chai ka kharcha", "2026-10-16"), (error) => error.code === "ASSISTANT_NOT_CONFIGURED");
  } finally {
    if (saved.xai !== undefined) process.env.XAI_API_KEY = saved.xai;
    if (saved.groq !== undefined) process.env.GROQ_API_KEY = saved.groq;
  }
});

test("a Groq key selects Groq's endpoint and model; without it xAI settings apply", () => {
  const saved = { groq: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL, xai: process.env.XAI_API_KEY };
  try {
    process.env.GROQ_API_KEY = "gsk_test";
    delete process.env.GROQ_MODEL;
    process.env.XAI_API_KEY = "xai-test";
    let settings = grokSettings();
    assert.equal(settings.provider, "Groq");
    assert.equal(settings.apiKey, "gsk_test");
    assert.equal(settings.baseUrl, "https://api.groq.com/openai/v1");
    assert.equal(settings.model, GROQ_DEFAULT_MODEL);
    delete process.env.GROQ_API_KEY;
    settings = grokSettings();
    assert.equal(settings.provider, "xAI");
    assert.equal(settings.apiKey, "xai-test");
  } finally {
    for (const [name, value] of [["GROQ_API_KEY", saved.groq], ["GROQ_MODEL", saved.model], ["XAI_API_KEY", saved.xai]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
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


test("product and purchase order proposals carry bodies the real services accept", async () => {
  const { createProduct: makeProduct } = await import("../../server/products/product.service.ts");
  const { productInputSchema } = await import("../../server/products/product.validation.ts");
  const { createPurchaseOrder, createSupplier } = await import("../../server/procurement/procurement.service.ts");
  const { purchaseOrderInputSchema, supplierInputSchema } = await import("../../server/procurement/procurement.validation.ts");
  const staff = { id: actor, name: "Tester", permissions: ["products:view", "products:create", "purchasing:view", "purchasing:create"] };

  const product = await executeTool("propose_product", { sku: `TTH-5-BR-YC-${run}`, name: `#5 Brass Y-Cut teeth ${run}`, category: "Teeth", productType: "Raw Material", unit: "Kgs", unitPrice: 1450, size: "#5", material: "Brass", finish: "", color: "", minimumStock: 50 }, staff);
  assert.equal(product.error, undefined);
  const savedProduct = await makeProduct(productInputSchema.parse(product.proposal.body), actor);
  assert.equal(savedProduct.sku, `TTH-5-BR-YC-${run}`);
  const duplicate = await executeTool("propose_product", { sku: `TTH-5-BR-YC-${run}`, name: "Again", category: "Teeth", productType: "Raw Material", unit: "Kgs", unitPrice: 1, size: "", material: "", finish: "", color: "", minimumStock: 0 }, staff);
  assert.match(duplicate.error, /already exists/);

  const supplier = await createSupplier(supplierInputSchema.parse({ code: `P-${run}`.slice(0, 20), name: `Brass House ${run}` }), actor);
  const order = await executeTool("propose_purchase_order", { supplierId: supplier.id, orderDate: "2026-10-16", expectedDate: "2026-10-25", notes: "", lines: [{ productId: savedProduct.id, quantity: 200, unitPrice: 1450, discountPercent: 0, taxPercent: 18 }] }, staff);
  assert.equal(order.error, undefined);
  assert.equal(order.proposal.endpoint, "/api/procurement/purchase-orders");
  const savedOrder = await createPurchaseOrder(purchaseOrderInputSchema.parse(order.proposal.body), actor);
  assert.equal(savedOrder.status, "DRAFT");
});

test("show_report returns a database table, filtered with exact totals, and respects report permissions", async () => {
  const salesOnly = { id: actor, name: "Sales", permissions: ["sales:view", "sales:create"] };
  assert.ok(toolsFor(salesOnly).find((tool) => tool.name === "show_report").parameters.properties.report.enum.includes("orders"));
  assert.ok(!toolsFor(salesOnly).find((tool) => tool.name === "show_report").parameters.properties.report.enum.includes("payroll"));
  const refused = await executeTool("show_report", { report: "payroll", from: "", to: "", search: "" }, salesOnly);
  assert.match(refused.error, /does not allow this report/);

  const outcome = await executeTool("show_report", { report: "orders", from: "2026-10-01", to: "2026-10-31", search: `Ali Traders ${run}` }, salesOnly);
  assert.equal(outcome.error, undefined);
  assert.equal(outcome.table.title, "Order Fulfilment");
  assert.ok(outcome.table.totalRows >= 1);
  assert.ok(outcome.table.rows.every((row) => String(row.customer).includes(run)));
  assert.equal(outcome.table.csvPath, "/api/reports/orders?format=csv&from=2026-10-01&to=2026-10-31");
  // The filtered total is the exact decimal sum of the shown rows.
  const sum = outcome.table.rows.reduce((total, row) => total + Math.round(Number(row.orderTotal) * 100), 0);
  assert.equal(Math.round(Number(outcome.table.totals.orderTotal) * 100), sum);
  assert.equal(outcome.result.rowCount, outcome.table.totalRows);
});

/* A local stand-in for the xAI endpoint (test only) that plays back a scripted conversation. */
async function withFakeGrok(script, work) {
  const requests = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const parsed = body ? JSON.parse(body) : null;
      requests.push({ url: request.url, auth: request.headers.authorization, body: parsed });
      const step = script(requests.length - 1, parsed, request.url) ?? { status: 500, body: { error: `unscripted request ${requests.length - 1}: ${JSON.stringify(parsed?.messages?.at(-1)).slice(0, 400)}` } };
      response.writeHead(step.status ?? 200, { "content-type": "application/json" });
      response.end(JSON.stringify(step.body));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const saved = { key: process.env.XAI_API_KEY, url: process.env.XAI_BASE_URL, model: process.env.XAI_MODEL };
  process.env.XAI_API_KEY = "test-key";
  process.env.XAI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  delete process.env.XAI_MODEL;
  try {
    return await work(requests);
  } finally {
    server.close();
    for (const [name, value] of [["XAI_API_KEY", saved.key], ["XAI_BASE_URL", saved.url], ["XAI_MODEL", saved.model]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const toolCall = (id, name, args) => ({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });
const answer = (content) => ({ choices: [{ finish_reason: "stop", message: { role: "assistant", content } }] });

test("a full Grok turn: lookup, proposal and report come back; nothing is written", async () => {
  const before = await executeTool("find_customers", { search: run }, everything);
  await withFakeGrok((index) => [
    toolCall("c1", "find_customers", { search: `Ali Traders ${run}` }),
    toolCall("c2", "propose_sales_order", { customerId: ctx.customer.id, orderDate: "2026-10-16", deliveryDate: "", notes: "", lines: [{ kind: "catalog", productId: ctx.product.id, productName: "", unit: "", quantity: 300, unitPrice: 12, discountPercent: 0, taxPercent: 0, notes: "" }] }),
    toolCall("c3", "show_report", { report: "orders", from: "2026-10-01", to: "2026-10-31", search: run }),
    answer("I prepared a draft order of 300 sliders for Ali Traders and showed this month's orders."),
  ].map((body) => ({ body }))[index], async (requests) => {
    const turn = await runAssistant(everything, [], "Order 300 sliders for Ali Traders and show me this month's orders", "2026-10-16");
    assert.equal(turn.proposals.length, 1);
    assert.equal(turn.proposals[0].kind, "sales_order");
    assert.equal(turn.tables.length, 1);
    assert.match(turn.reply, /draft order/);
    assert.deepEqual(turn.messages.map((message) => message.role), ["user", "assistant", "tool", "assistant", "tool", "assistant", "tool", "assistant"]);
    assert.equal(requests.length, 4);
    assert.equal(requests[0].auth, "Bearer test-key");
    assert.equal(requests[0].url, "/v1/chat/completions");
    assert.equal(requests[0].body.model, "grok-4.3");
    assert.equal(requests[0].body.messages[0].role, "system");
    assert.ok(requests[0].body.tools.some((tool) => tool.type === "function" && tool.function.name === "propose_sales_order"));
    const lookupResult = JSON.parse(requests[1].body.messages.at(-1).content);
    assert.equal(lookupResult[0].id, ctx.customer.id);
  });
  const after = await executeTool("find_customers", { search: run }, everything);
  assert.equal(after.result.length, before.result.length);
});

test("Grok failures become clear messages", async () => {
  await withFakeGrok(() => ({ status: 401, body: { error: "Incorrect API key provided" } }), async () => {
    await assert.rejects(runAssistant(everything, [], "hi", "2026-10-16"), (error) => error.code === "ASSISTANT_KEY_INVALID" && /XAI_API_KEY/.test(error.message));
  });
  await withFakeGrok((index, body, url) => (url.endsWith("/models")
    ? { body: { data: [{ id: "grok-4.6" }, { id: "grok-4.5" }] } }
    : { status: 404, body: { error: { message: "The model grok-4.3 does not exist" } } }), async () => {
    await assert.rejects(runAssistant(everything, [], "hi", "2026-10-16"), (error) => error.code === "ASSISTANT_MODEL_UNAVAILABLE" && /grok-4\.6, grok-4\.5/.test(error.message) && /XAI_MODEL/.test(error.message));
  });
  await withFakeGrok(() => ({ status: 429, body: { error: "rate limited" } }), async () => {
    await assert.rejects(runAssistant(everything, [], "hi", "2026-10-16"), (error) => error.code === "ASSISTANT_RATE_LIMITED");
  });
});

test("switched off, the assistant refuses before calling any AI service", async () => {
  await withFakeGrok(() => ({ body: answer("should not be called") }), async (requests) => {
    process.env.AI_ASSISTANT_ENABLED = "false";
    try {
      await assert.rejects(runAssistant(everything, [], "hi", "2026-10-16"), (error) => error.code === "ASSISTANT_DISABLED");
      assert.equal(requests.length, 0);
    } finally {
      process.env.AI_ASSISTANT_ENABLED = "true";
    }
  });
});

test("the assistant switches on when an AI key is set, and AI_ASSISTANT_ENABLED=false keeps it off", () => {
  const saved = { flag: process.env.AI_ASSISTANT_ENABLED, groq: process.env.GROQ_API_KEY, xai: process.env.XAI_API_KEY };
  try {
    delete process.env.AI_ASSISTANT_ENABLED;
    delete process.env.XAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    assert.equal(grokSettings().enabled, false, "no key: off");
    process.env.GROQ_API_KEY = "gsk_test";
    assert.equal(grokSettings().enabled, true, "key set: on");
    process.env.AI_ASSISTANT_ENABLED = "false";
    assert.equal(grokSettings().enabled, false, "explicitly switched off");
  } finally {
    for (const [name, value] of [["AI_ASSISTANT_ENABLED", saved.flag], ["GROQ_API_KEY", saved.groq], ["XAI_API_KEY", saved.xai]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("on Groq, a default model missing from the account is replaced by one it has", async () => {
  const { chat } = await import("../../server/assistant/grok.ts");
  const seen = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (request.url.endsWith("/models")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ id: "whisper-large-v3" }, { id: "openai/gpt-oss-20b" }] }));
        return;
      }
      const { model } = JSON.parse(body);
      seen.push(model);
      if (model !== "openai/gpt-oss-20b") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: `The model \`${model}\` does not exist or you do not have access to it.` } }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const saved = { key: process.env.GROQ_API_KEY, url: process.env.GROQ_BASE_URL, model: process.env.GROQ_MODEL };
  process.env.GROQ_API_KEY = "gsk_test";
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${server.address().port}/openai/v1`;
  delete process.env.GROQ_MODEL;
  try {
    const result = await chat([{ role: "user", content: "hi" }], []);
    assert.equal(result.message.content, "ok");
    assert.deepEqual(seen, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    // An explicit GROQ_MODEL is never swapped: its error is reported as is.
    process.env.GROQ_MODEL = "missing-model";
    await assert.rejects(chat([{ role: "user", content: "hi" }], []), (error) => error.code === "ASSISTANT_MODEL_UNAVAILABLE" && /missing-model/.test(error.message));
    assert.equal(seen.at(-1), "missing-model");
  } finally {
    server.close();
    for (const [name, value] of [["GROQ_API_KEY", saved.key], ["GROQ_BASE_URL", saved.url], ["GROQ_MODEL", saved.model]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
