/*
 * ERP assistant (D-036): the user types what happened in plain words
 * ("New order for Ali Traders: 5000 #5 sliders at Rs 12") and Claude prepares the
 * entry. Claude never writes anything. It looks records up through read-only
 * tools (each checked against the user's own permissions) and returns
 * proposals: the exact body for an existing API route, validated here with
 * that route's own schema. The user reviews each proposal and confirms it in
 * the browser, which posts it to the normal route with the user's session,
 * so every permission, validation and audit rule applies unchanged.
 */

import { randomUUID } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";

import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { listAccounts } from "../ledger/ledger.service";
import { cashTransactionInputSchema } from "../ledger/ledger.validation";
import { listEmployees } from "../payroll/hr.service";
import { employeeQuerySchema } from "../payroll/hr.validation";
import { listLeaveTypes } from "../payroll/leave.service";
import { leaveRequestInputSchema } from "../payroll/leave.validation";
import { listSuppliers } from "../procurement/procurement.service";
import { listQuerySchema, requisitionInputSchema, supplierInputSchema } from "../procurement/procurement.validation";
import { listProducts } from "../products/product.service";
import { productQuerySchema } from "../products/product.validation";
import { listCustomers } from "../sales/sales.service";
import { customerInputSchema, salesOrderInputSchema } from "../sales/sales.validation";

export const ASSISTANT_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 10;
const MAX_HISTORY_MESSAGES = 60;

type User = { id: string; name?: string; email?: string; permissions: string[] };
type Json = Record<string, unknown>;

export type Proposal = {
  id: string;
  kind: string;
  title: string;
  summary: Array<[string, string]>;
  method: "POST";
  endpoint: string;
  body: Json;
  permission: string;
  openPath: string;
};

type SchemaLike = { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } };

/* ------------------------------------------------------------------ */
/* Tool definitions                                                    */
/* ------------------------------------------------------------------ */

const search = { type: "object", properties: { search: { type: "string", description: "Words to match (name, code, SKU, email). Empty lists the first records." } }, required: ["search"], additionalProperties: false } as const;
const dateField = { type: "string", description: "YYYY-MM-DD" };
const text = (description: string) => ({ type: "string", description });

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "find_customers", description: "Search active customers. Returns id, code, name, email, phone.", input_schema: search },
  { name: "find_products", description: "Search the item master (SKU, name, category, size, finish). Returns id, sku, name, unit, unitPrice, status. Every distinct specification is its own SKU.", input_schema: search },
  { name: "find_suppliers", description: "Search suppliers. Returns id, code, name.", input_schema: search },
  { name: "find_employees", description: "Search active employees. Returns id, employee code, name, department.", input_schema: search },
  { name: "list_leave_types", description: "All leave types with id, code, name and annual days.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_accounts", description: "Chart of accounts: id, code, name, type, isCashBank. Cash/bank accounts pay or receive; expense or income accounts are the other side.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "propose_customer",
    description: "Prepare a new customer for the user to confirm. Check find_customers first so you do not duplicate one.",
    input_schema: { type: "object", properties: { code: text("Short unique customer code, e.g. ALI-TRD"), name: text("Customer name"), email: text("Email or empty"), phone: text("Phone or empty") }, required: ["code", "name", "email", "phone"], additionalProperties: false },
  },
  {
    name: "propose_supplier",
    description: "Prepare a new supplier for the user to confirm. Check find_suppliers first.",
    input_schema: {
      type: "object",
      properties: {
        code: text("2-20 capital letters, digits or dashes"), name: text("Supplier name"), contactName: text("Contact person or empty"),
        phone: text("Phone or empty"), email: text("Email or empty"), address: text("Address or empty"),
        taxRegistration: text("NTN/STRN or empty"), paymentTermsDays: { type: "integer", description: "0-365, usually 30" }, notes: text("Notes or empty"),
      },
      required: ["code", "name", "contactName", "phone", "email", "address", "taxRegistration", "paymentTermsDays", "notes"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_sales_order",
    description: "Prepare a DRAFT sales order for the user to confirm (a manager approves it later in the app). Use ids from find_customers and find_products; use a custom line only when the item is not in the item master.",
    input_schema: {
      type: "object",
      properties: {
        customerId: text("Customer id from find_customers"), orderDate: dateField, deliveryDate: { type: "string", description: "YYYY-MM-DD or empty" }, notes: text("Order notes or empty"),
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["catalog", "custom"] },
              productId: text("For catalog lines: id from find_products; empty for custom lines"),
              productName: text("For custom lines: item description; empty for catalog lines"),
              unit: text("For custom lines: Pcs, Meters, Kgs, Boxes, Sets or Gross; empty for catalog lines"),
              quantity: { type: "number" }, unitPrice: { type: "number" },
              discountPercent: { type: "integer", description: "0-100" }, taxPercent: { type: "integer", description: "0-100" },
              notes: text("Line notes or empty"),
            },
            required: ["kind", "productId", "productName", "unit", "quantity", "unitPrice", "discountPercent", "taxPercent", "notes"],
            additionalProperties: false,
          },
        },
      },
      required: ["customerId", "orderDate", "deliveryDate", "notes", "lines"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_purchase_requisition",
    description: "Prepare a DRAFT purchase requisition (items to buy) for the user to confirm.",
    input_schema: {
      type: "object",
      properties: {
        neededBy: { type: "string", description: "YYYY-MM-DD or empty" }, notes: text("Notes or empty"),
        lines: { type: "array", items: { type: "object", properties: { productId: text("Id from find_products"), quantity: { type: "number" }, notes: text("Line notes or empty") }, required: ["productId", "quantity", "notes"], additionalProperties: false } },
      },
      required: ["neededBy", "notes", "lines"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_cash_entry",
    description: "Prepare an expense paid, income received, or a transfer between cash/bank accounts, for the user to confirm. cashAccountId is the cash or bank account; counterAccountId is the expense/income account (or the other cash/bank account for a transfer). Use list_accounts for both ids.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["EXPENSE", "INCOME", "TRANSFER"] }, transactionDate: dateField,
        cashAccountId: text("Cash or bank account id"), counterAccountId: text("Expense, income or other cash/bank account id"),
        amount: { type: "number", description: "Rupees, greater than zero" }, payee: text("Paid to / received from, or empty"),
        reference: text("Voucher or cheque number, or empty"), description: text("What it was for, at least 3 characters"),
      },
      required: ["kind", "transactionDate", "cashAccountId", "counterAccountId", "amount", "payee", "reference", "description"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_leave_request",
    description: "Prepare a leave request for an employee, for the user to confirm (HR approves it later in the app).",
    input_schema: {
      type: "object",
      properties: { employeeId: text("Id from find_employees"), leaveTypeId: text("Id from list_leave_types"), fromDate: dateField, toDate: dateField, reason: text("Reason, at least 3 characters") },
      required: ["employeeId", "leaveTypeId", "fromDate", "toDate", "reason"],
      additionalProperties: false,
    },
  },
];

/* Who may use each tool: a lookup needs the module's view right, a proposal the right of the route it targets. */
const TOOL_PERMISSIONS: Record<string, string[]> = {
  find_customers: ["customers:view", "sales:view"],
  find_products: ["products:view"],
  find_suppliers: ["purchasing:view"],
  find_employees: ["hr:view"],
  list_leave_types: ["hr:view"],
  list_accounts: ["finance:view"],
  propose_customer: ["customers:create"],
  propose_supplier: ["purchasing:create"],
  propose_sales_order: ["sales:create"],
  propose_purchase_requisition: ["purchasing:create", "production:update"],
  propose_cash_entry: ["finance:create"],
  propose_leave_request: ["hr:manage"],
};

export function toolsFor(user: User) {
  return TOOLS.filter((tool) => TOOL_PERMISSIONS[tool.name].some((permission) => user.permissions.includes(permission)));
}

/* ------------------------------------------------------------------ */
/* Tool execution                                                      */
/* ------------------------------------------------------------------ */

function validate(schema: SchemaLike, body: unknown) {
  const parsed = schema.safeParse(body);
  if (parsed.success) return null;
  return parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
}

async function productNames(ids: string[]) {
  if (!ids.length) return new Map<string, { sku: string; name: string; unit: string }>();
  const rows = await db.orm.public.Product.where((product) => product.id.in(ids)).all();
  return new Map(rows.map((row) => [row.id, { sku: row.sku, name: row.name, unit: row.unit }]));
}

const money = (value: number) => value.toLocaleString("en-PK", { maximumFractionDigits: 2 });

async function propose(name: string, input: Json, user: User): Promise<Proposal | string> {
  const permission = TOOL_PERMISSIONS[name].find((code) => user.permissions.includes(code)) ?? TOOL_PERMISSIONS[name][0];
  const id = randomUUID();

  if (name === "propose_customer") {
    const body = { code: input.code, name: input.name, email: input.email ?? "", phone: input.phone ?? "" };
    const problem = validate(customerInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    return { id, kind: "customer", title: `New customer ${body.name}`, summary: [["Code", String(body.code)], ["Name", String(body.name)], ["Email", String(body.email || "-")], ["Phone", String(body.phone || "-")]], method: "POST", endpoint: "/api/customers", body, permission, openPath: "/sales/customers" };
  }

  if (name === "propose_supplier") {
    const body: Json = { ...input, paymentTermsDays: Number(input.paymentTermsDays ?? 30) };
    const problem = validate(supplierInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    return { id, kind: "supplier", title: `New supplier ${body.name}`, summary: [["Code", String(body.code)], ["Name", String(body.name)], ["Contact", String(body.contactName || "-")], ["Phone", String(body.phone || "-")], ["Payment terms", `${body.paymentTermsDays} days`]], method: "POST", endpoint: "/api/procurement/suppliers", body, permission, openPath: "/procurement/suppliers" };
  }

  if (name === "propose_sales_order") {
    const lines = (input.lines as Json[] | undefined ?? []).map((line) => line.kind === "catalog"
      ? { kind: "catalog", productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent ?? 0, taxPercent: line.taxPercent ?? 0, notes: line.notes ?? "" }
      : { kind: "custom", productName: line.productName, unit: line.unit, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent ?? 0, taxPercent: line.taxPercent ?? 0, notes: line.notes ?? "" });
    const body = { customerId: input.customerId, orderDate: input.orderDate, deliveryDate: input.deliveryDate ?? "", notes: input.notes ?? "", lines };
    const problem = validate(salesOrderInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    const customer = await db.orm.public.Customer.where({ id: String(body.customerId) }).first();
    if (!customer) return "Not valid: customerId does not match a customer. Use find_customers.";
    const products = await productNames(lines.filter((line) => line.kind === "catalog").map((line) => String(line.productId)));
    const missing = lines.find((line) => line.kind === "catalog" && !products.has(String(line.productId)));
    if (missing) return `Not valid: product ${missing.productId} was not found. Use find_products.`;
    const summary: Array<[string, string]> = [["Customer", `${customer.name} (${customer.code})`], ["Order date", String(body.orderDate)], ["Delivery", String(body.deliveryDate || "-")]];
    for (const line of lines) {
      const item = line.kind === "catalog" ? products.get(String(line.productId)) : null;
      const label = item ? `${item.sku} ${item.name}` : String(line.productName);
      summary.push([label, `${money(Number(line.quantity))} ${item?.unit ?? line.unit} × ${money(Number(line.unitPrice))}${line.discountPercent ? `, −${line.discountPercent}%` : ""}${line.taxPercent ? `, tax ${line.taxPercent}%` : ""}`]);
    }
    return { id, kind: "sales_order", title: `Draft sales order for ${customer.name}`, summary, method: "POST", endpoint: "/api/sales/orders", body, permission, openPath: "/sales/orders" };
  }

  if (name === "propose_purchase_requisition") {
    const lines = (input.lines as Json[] | undefined ?? []).map((line) => ({ productId: line.productId, quantity: line.quantity, notes: line.notes ?? "" }));
    const body = { neededBy: input.neededBy ?? "", notes: input.notes ?? "", lines, plannedOrderIds: [], idempotencyKey: id };
    const problem = validate(requisitionInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    const products = await productNames(lines.map((line) => String(line.productId)));
    const missing = lines.find((line) => !products.has(String(line.productId)));
    if (missing) return `Not valid: product ${missing.productId} was not found. Use find_products.`;
    const summary: Array<[string, string]> = [["Needed by", String(body.neededBy || "-")]];
    for (const line of lines) {
      const item = products.get(String(line.productId))!;
      summary.push([`${item.sku} ${item.name}`, `${money(Number(line.quantity))} ${item.unit}`]);
    }
    return { id, kind: "requisition", title: "Draft purchase requisition", summary, method: "POST", endpoint: "/api/procurement/requisitions", body, permission, openPath: "/procurement/requisitions" };
  }

  if (name === "propose_cash_entry") {
    const body: Json = { ...input, idempotencyKey: id };
    const problem = validate(cashTransactionInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    const accounts = await listAccounts();
    const cash = accounts.find((account) => account.id === body.cashAccountId);
    const counter = accounts.find((account) => account.id === body.counterAccountId);
    if (!cash || !cash.isCashBank) return "Not valid: cashAccountId must be a cash or bank account from list_accounts.";
    if (!counter) return "Not valid: counterAccountId was not found. Use list_accounts.";
    const label = { EXPENSE: "Expense", INCOME: "Income", TRANSFER: "Transfer" }[String(body.kind)] ?? String(body.kind);
    return {
      id, kind: "cash_entry", title: `${label} of Rs ${money(Number(body.amount))}`,
      summary: [["Date", String(body.transactionDate)], [body.kind === "INCOME" ? "Received into" : "Paid from", `${cash.code} ${cash.name}`], [body.kind === "TRANSFER" ? "To" : "Account", `${counter.code} ${counter.name}`], ["Amount", `Rs ${money(Number(body.amount))}`], ["Payee", String(body.payee || "-")], ["For", String(body.description)]],
      method: "POST", endpoint: "/api/ledger/cash-transactions", body, permission, openPath: body.kind === "INCOME" ? "/finance/income" : "/finance/expenses",
    };
  }

  if (name === "propose_leave_request") {
    const body: Json = { ...input, idempotencyKey: id };
    const problem = validate(leaveRequestInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    const employee = await db.orm.public.Employee.where({ id: String(body.employeeId) }).first();
    const leaveType = (await listLeaveTypes()).find((type) => type.id === body.leaveTypeId);
    if (!employee) return "Not valid: employeeId was not found. Use find_employees.";
    if (!leaveType) return "Not valid: leaveTypeId was not found. Use list_leave_types.";
    return { id, kind: "leave_request", title: `${leaveType.name} for ${employee.name}`, summary: [["Employee", `${employee.name} (${employee.employeeCode})`], ["Type", leaveType.name], ["From", String(body.fromDate)], ["To", String(body.toDate)], ["Reason", String(body.reason)]], method: "POST", endpoint: "/api/hr/leave-requests", body, permission, openPath: "/people-payroll/leave" };
  }

  return `Unknown tool ${name}.`;
}

async function lookup(name: string, input: Json, user: User): Promise<unknown> {
  const term = String(input.search ?? "").slice(0, 120);
  if (name === "find_customers") {
    const { customers } = await listCustomers(term, 1, 15);
    return customers.map((row) => ({ id: row.id, code: row.code, name: row.name, email: row.email, phone: row.phone }));
  }
  if (name === "find_products") {
    const { products } = await listProducts(productQuerySchema.parse({ search: term, pageSize: 20 }));
    return products.map((row: Json) => ({ id: row.id, sku: row.sku, name: row.name, category: row.category, size: row.size, finish: row.finish, unit: row.unit, unitPrice: row.unitPrice, status: row.status }));
  }
  if (name === "find_suppliers") {
    const { suppliers } = await listSuppliers(listQuerySchema.parse({ search: term, pageSize: 15 }));
    return suppliers.map((row) => ({ id: row.id, code: row.code, name: row.name, status: row.status }));
  }
  if (name === "find_employees") {
    const { employees } = await listEmployees(employeeQuerySchema.parse({ search: term, pageSize: 15 }), false);
    return employees.map((row) => ({ id: row.id, employeeCode: row.employeeCode, name: row.name, department: row.departmentName }));
  }
  if (name === "list_leave_types") {
    return (await listLeaveTypes()).filter((row) => row.status === "ACTIVE").map((row) => ({ id: row.id, code: row.code, name: row.name, annualDays: row.annualDays }));
  }
  if (name === "list_accounts") {
    return (await listAccounts()).filter((row) => row.status === "ACTIVE").map((row) => ({ id: row.id, code: row.code, name: row.name, type: row.accountType, isCashBank: row.isCashBank }));
  }
  void user;
  return `Unknown tool ${name}.`;
}

/* Runs one tool for this user. Exported for tests; the conversation loop is the only other caller. */
export async function executeTool(name: string, rawInput: unknown, user: User): Promise<{ proposal?: Proposal; result?: unknown; error?: string }> {
  if (!TOOL_PERMISSIONS[name]?.some((permission) => user.permissions.includes(permission))) return { error: "The user's role does not allow this." };
  const input = (rawInput && typeof rawInput === "object" ? rawInput : {}) as Json;
  try {
    if (name.startsWith("propose_")) {
      const outcome = await propose(name, input, user);
      return typeof outcome === "string" ? { error: outcome } : { proposal: outcome };
    }
    return { result: await lookup(name, input, user) };
  } catch (error) {
    return { error: `Lookup failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function runTool(block: Anthropic.Beta.BetaToolUseBlock, user: User, proposals: Proposal[]): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const outcome = await executeTool(block.name, block.input, user);
  if (outcome.error) return { type: "tool_result", tool_use_id: block.id, content: outcome.error, is_error: true };
  if (outcome.proposal) {
    proposals.push(outcome.proposal);
    return { type: "tool_result", tool_use_id: block.id, content: `Prepared "${outcome.proposal.title}". It is NOT saved: the user must review it and press Confirm. Summarise it briefly.` };
  }
  return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(outcome.result) };
}

/* ------------------------------------------------------------------ */
/* Conversation                                                        */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are the data-entry assistant inside Apparel Fastener ERP, used by a zipper and fastener manufacturer in Pakistan. Staff tell you, in English, Urdu or Roman Urdu, what happened, and you prepare the matching ERP entry for them to confirm.

How you work:
- Look records up with the find_/list_ tools and use only ids those tools returned. Never invent an id, price, quantity, date or name.
- When the request is ambiguous (several matching customers or items, a missing quantity or price), ask one short question instead of guessing.
- Every distinct item specification is its own SKU (a #5 Brass Y-Cut tooth and a #5 Aluminium Plain tooth are different items); match the exact one.
- Prepare an entry with the matching propose_ tool. A proposal is not saved: the user reviews it on a card and presses Confirm. Never say an entry was saved, posted or approved.
- If a propose_ tool reports a problem, fix the input and try again, or tell the user what is missing.
- You can only prepare: customers, suppliers, draft sales orders, draft purchase requisitions, expenses/income/transfers, and leave requests. For anything else (approving, posting stock, invoices, payroll), say which ERP screen to use.
- Amounts are Pakistani rupees unless the user says otherwise. Dates are YYYY-MM-DD.
- Always reply in English, in one to three short sentences, even when the user writes in Urdu or Roman Urdu. Switch language only if the user explicitly asks you to.`;

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError("The AI assistant is not set up yet. An administrator must add ANTHROPIC_API_KEY to the server environment.", { code: "ASSISTANT_NOT_CONFIGURED", status: 503 });
  }
  client ??= new Anthropic();
  return client;
}

export type AssistantTurn = { messages: Anthropic.Beta.BetaMessageParam[]; reply: string; proposals: Proposal[] };

export async function runAssistant(user: User, history: Anthropic.Beta.BetaMessageParam[], userText: string, today: string): Promise<AssistantTurn> {
  const tools = toolsFor(user);
  if (!tools.some((tool) => tool.name.startsWith("propose_"))) {
    throw new AppError("Your role cannot create any of the entries the assistant prepares.", { code: "FORBIDDEN", status: 403 });
  }
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history.slice(-MAX_HISTORY_MESSAGES), { role: "user", content: userText }];
  const proposals: Proposal[] = [];
  const context = `Today is ${today}. The user is ${user.name ?? user.email ?? "a staff member"}.`;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await anthropic().beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }, { type: "text", text: context }],
      tools,
      tool_choice: { type: "auto" },
      messages,
    });
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "refusal") {
      return { messages, reply: "I can't help with that request.", proposals };
    }
    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = response.content.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text").map((block) => block.text).join("\n").trim();
      return { messages, reply: reply || (proposals.length ? "Please review and confirm." : ""), proposals };
    }
    const results = await Promise.all(toolUses.map((block) => runTool(block, user, proposals)));
    messages.push({ role: "user", content: results });
  }
  return { messages, reply: "That took too many steps. Please say it more simply, one entry at a time.", proposals };
}
