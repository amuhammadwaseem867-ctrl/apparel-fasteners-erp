/*
 * The assistant's tools (D-036, D-037). Three kinds, all checked against the
 * signed-in user's own permissions on every call:
 *   - lookups (find_*, list_*): read-only, return records the model may use;
 *   - show_report: runs one of the ERP reports and returns it as a table for
 *     the user (the numbers come from the database, never from the model);
 *   - propose_*: prepare an entry. Nothing is written. The proposal is the
 *     exact body of an existing API route, validated with that route's own
 *     schema; the user confirms it in the browser, which posts it with the
 *     user's session.
 */

import { randomUUID } from "node:crypto";

import { db } from "../core/database/client";
import { addDecimalStrings } from "../core/utils/decimal";
import { listAccounts } from "../ledger/ledger.service";
import { cashTransactionInputSchema } from "../ledger/ledger.validation";
import { listEmployees } from "../payroll/hr.service";
import { employeeQuerySchema } from "../payroll/hr.validation";
import { listLeaveTypes } from "../payroll/leave.service";
import { leaveRequestInputSchema } from "../payroll/leave.validation";
import { listBuySuggestions, listSuppliers } from "../procurement/procurement.service";
import { listQuerySchema, purchaseOrderInputSchema, requisitionInputSchema, supplierInputSchema } from "../procurement/procurement.validation";
import { listProducts } from "../products/product.service";
import { productInputSchema, productQuerySchema } from "../products/product.validation";
import { REPORTS, runReport } from "../reports/reports.service";
import { listCustomers } from "../sales/sales.service";
import { customerInputSchema, salesOrderInputSchema } from "../sales/sales.validation";

export type User = { id: string; name?: string; email?: string; permissions: string[] };
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

export type ReportTable = {
  id: string;
  report: string;
  title: string;
  description: string;
  from: string | null;
  to: string | null;
  columns: Array<{ key: string; label: string; type: string }>;
  rows: Array<Record<string, unknown>>;
  totals: Record<string, string>;
  totalRows: number;
  truncated: boolean;
  csvPath: string;
};

export type ToolDefinition = { name: string; description: string; parameters: Json };
export type ToolOutcome = { proposal?: Proposal; table?: ReportTable; result?: unknown; error?: string };

type SchemaLike = { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } };

const MAX_TABLE_ROWS = 200;
const MODEL_SAMPLE_ROWS = 40;

/* ------------------------------------------------------------------ */
/* Definitions                                                         */
/* ------------------------------------------------------------------ */

const searchParams = { type: "object", properties: { search: { type: "string", description: "Words to match (name, code, SKU, email). Empty lists the first records." } }, required: ["search"], additionalProperties: false };
const noParams = { type: "object", properties: {}, additionalProperties: false };
const dateField = { type: "string", description: "YYYY-MM-DD" };
const optionalDate = { type: "string", description: "YYYY-MM-DD or empty" };
const text = (description: string) => ({ type: "string", description });
const object = (properties: Json, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });

const DEFINITIONS: ToolDefinition[] = [
  { name: "find_customers", description: "Search active customers. Returns id, code, name, email, phone.", parameters: searchParams },
  { name: "find_products", description: "Search the item master (SKU, name, category, size, finish). Returns id, sku, name, unit, unitPrice, status. Every distinct specification is its own SKU.", parameters: searchParams },
  { name: "find_suppliers", description: "Search suppliers. Returns id, code, name.", parameters: searchParams },
  { name: "find_employees", description: "Search active employees. Returns id, employee code, name, department.", parameters: searchParams },
  { name: "list_leave_types", description: "All active leave types with id, code, name and annual days.", parameters: noParams },
  { name: "list_accounts", description: "Chart of accounts: id, code, name, type, isCashBank. Cash/bank accounts pay or receive; expense or income accounts are the other side.", parameters: noParams },
  { name: "list_buy_suggestions", description: "Confirmed MRP BUY suggestions not yet on a requisition: id (plannedOrderId), product, quantity, due date. Use these ids in propose_purchase_requisition.plannedOrderIds to buy what MRP found short.", parameters: noParams },
  {
    name: "show_report",
    description: "Show the user an ERP report as a table, with totals and a CSV download, straight from the database. Use it for any question about orders, deliveries, dispatches, packing, production, wastage, quality, NCR/CAPA, stock, movements, receivables or payroll. You get a summary back to answer from; the table itself is shown to the user.",
    parameters: object({
      report: { type: "string", description: "Report key (see the enum).", enum: Object.keys(REPORTS) },
      from: optionalDate,
      to: optionalDate,
      search: text("Optional words that every shown row must contain (a customer, SKU, status...), or empty for all rows"),
    }),
  },
  {
    name: "propose_customer",
    description: "Prepare a new customer for the user to confirm. Check find_customers first so you do not duplicate one.",
    parameters: object({ code: text("Short unique customer code, e.g. ALI-TRD"), name: text("Customer name"), email: text("Email or empty"), phone: text("Phone or empty") }),
  },
  {
    name: "propose_supplier",
    description: "Prepare a new supplier for the user to confirm. Check find_suppliers first.",
    parameters: object({
      code: text("2-20 capital letters, digits or dashes"), name: text("Supplier name"), contactName: text("Contact person or empty"),
      phone: text("Phone or empty"), email: text("Email or empty"), address: text("Address or empty"),
      taxRegistration: text("NTN/STRN or empty"), paymentTermsDays: { type: "integer", description: "0-365, usually 30" }, notes: text("Notes or empty"),
    }),
  },
  {
    name: "propose_product",
    description: "Prepare a new item-master entry (raw material, component or finished good) for the user to confirm. Check find_products first: each distinct specification is its own SKU, so never reuse a SKU for a different specification.",
    parameters: object({
      sku: text("Unique SKU, e.g. SLI-5-DA-ANSI-PL"), name: text("Item name"), category: text("Teeth, Sliders, Top Stops, Bottom, Pin Box, Two Pins, Tape, Other Raw Materials or Finished Goods"),
      productType: text("Raw Material, Component, Semi-Finished or Finished Good"), unit: text("Pcs, Meters, Kgs, Boxes, Sets or Gross"),
      unitPrice: { type: "number", description: "Rupees per unit, 0 if unknown" }, size: text("Size or empty"), material: text("Material or empty"),
      finish: text("Finish or empty"), color: text("Colour or empty"), minimumStock: { type: "number", description: "Re-order level, 0 if none" },
    }),
  },
  {
    name: "propose_sales_order",
    description: "Prepare a DRAFT sales order for the user to confirm (a manager approves it later in the app). Use ids from find_customers and find_products; use a custom line only when the item is not in the item master.",
    parameters: object({
      customerId: text("Customer id from find_customers"), orderDate: dateField, deliveryDate: optionalDate, notes: text("Order notes or empty"),
      lines: {
        type: "array",
        items: object({
          kind: { type: "string", enum: ["catalog", "custom"] },
          productId: text("For catalog lines: id from find_products; empty for custom lines"),
          productName: text("For custom lines: item description; empty for catalog lines"),
          unit: text("For custom lines: Pcs, Meters, Kgs, Boxes, Sets or Gross; empty for catalog lines"),
          quantity: { type: "number" }, unitPrice: { type: "number" },
          discountPercent: { type: "integer", description: "0-100" }, taxPercent: { type: "integer", description: "0-100" },
          notes: text("Line notes or empty"),
        }),
      },
    }),
  },
  {
    name: "propose_purchase_requisition",
    description: "Prepare a DRAFT purchase requisition for the user to confirm: items typed by the user (lines) and/or MRP buy suggestions (plannedOrderIds from list_buy_suggestions).",
    parameters: object({
      neededBy: optionalDate, notes: text("Notes or empty"),
      lines: { type: "array", items: object({ productId: text("Id from find_products"), quantity: { type: "number" }, notes: text("Line notes or empty") }) },
      plannedOrderIds: { type: "array", items: { type: "string" }, description: "Ids from list_buy_suggestions, or an empty list" },
    }),
  },
  {
    name: "propose_purchase_order",
    description: "Prepare a DRAFT purchase order to a supplier for the user to confirm (a purchase manager approves it later in the app).",
    parameters: object({
      supplierId: text("Id from find_suppliers"), orderDate: dateField, expectedDate: optionalDate, notes: text("Notes or empty"),
      lines: { type: "array", items: object({ productId: text("Id from find_products"), quantity: { type: "number" }, unitPrice: { type: "number" }, discountPercent: { type: "integer" }, taxPercent: { type: "integer" } }) },
    }),
  },
  {
    name: "propose_cash_entry",
    description: "Prepare an expense paid, income received, or a transfer between cash/bank accounts, for the user to confirm. cashAccountId is the cash or bank account; counterAccountId is the expense/income account (or the other cash/bank account for a transfer). Use list_accounts for both ids.",
    parameters: object({
      kind: { type: "string", enum: ["EXPENSE", "INCOME", "TRANSFER"] }, transactionDate: dateField,
      cashAccountId: text("Cash or bank account id"), counterAccountId: text("Expense, income or other cash/bank account id"),
      amount: { type: "number", description: "Rupees, greater than zero" }, payee: text("Paid to / received from, or empty"),
      reference: text("Voucher or cheque number, or empty"), description: text("What it was for, at least 3 characters"),
    }),
  },
  {
    name: "propose_leave_request",
    description: "Prepare a leave request for an employee, for the user to confirm (HR approves it later in the app).",
    parameters: object({ employeeId: text("Id from find_employees"), leaveTypeId: text("Id from list_leave_types"), fromDate: dateField, toDate: dateField, reason: text("Reason, at least 3 characters") }),
  },
];

/* A lookup needs the module's view right, a proposal the right of the route it targets. show_report checks each report's own rights. */
const TOOL_PERMISSIONS: Record<string, string[]> = {
  find_customers: ["customers:view", "sales:view"],
  find_products: ["products:view"],
  find_suppliers: ["purchasing:view"],
  find_employees: ["hr:view"],
  list_leave_types: ["hr:view"],
  list_accounts: ["finance:view"],
  list_buy_suggestions: ["purchasing:view", "production:view"],
  show_report: [...new Set(Object.values(REPORTS).flatMap((report) => report.permissions))],
  propose_customer: ["customers:create"],
  propose_supplier: ["purchasing:create"],
  propose_product: ["products:create"],
  propose_sales_order: ["sales:create"],
  propose_purchase_requisition: ["purchasing:create", "production:update"],
  propose_purchase_order: ["purchasing:create"],
  propose_cash_entry: ["finance:create"],
  propose_leave_request: ["hr:manage"],
};

type BuySuggestion = { id: string; sku: string; productName: string; unit: string; runNumber: string; quantity: string; dueDate: string | null };
const buySuggestions = async () => (await listBuySuggestions()) as unknown as BuySuggestion[];

const allowed = (user: User, codes: string[]) => codes.some((code) => user.permissions.includes(code));

export function reportsFor(user: User) {
  return Object.keys(REPORTS).filter((key) => allowed(user, REPORTS[key].permissions));
}

/* The tools this user may use; show_report lists only the reports this user may open. */
export function toolsFor(user: User): ToolDefinition[] {
  return DEFINITIONS.filter((tool) => allowed(user, TOOL_PERMISSIONS[tool.name])).map((tool) => {
    if (tool.name !== "show_report") return tool;
    const keys = reportsFor(user);
    const catalogue = keys.map((key) => `${key}: ${REPORTS[key].title}`).join("; ");
    const parameters = structuredClone(tool.parameters) as { properties: { report: { enum: string[]; description: string } } };
    parameters.properties.report.enum = keys;
    parameters.properties.report.description = `Report key. ${catalogue}.`;
    return { ...tool, parameters };
  });
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
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
const lineAmount = (line: Json) => `${money(Number(line.quantity))} × ${money(Number(line.unitPrice))}${line.discountPercent ? `, −${line.discountPercent}%` : ""}${line.taxPercent ? `, tax ${line.taxPercent}%` : ""}`;

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

  if (name === "propose_product") {
    const body: Json = {
      sku: input.sku, name: input.name, description: "", category: input.category, productType: input.productType, variant: "", unit: input.unit,
      unitPrice: Number(input.unitPrice ?? 0), status: "ACTIVE", size: input.size ?? "", material: input.material ?? "", itemType: "",
      finish: input.finish ?? "", color: input.color ?? "", logoType: "", barcode: "", minimumStock: Number(input.minimumStock ?? 0),
    };
    const problem = validate(productInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    const duplicate = await db.orm.public.Product.where({ sku: String(body.sku) }).first();
    if (duplicate) return `Not valid: SKU ${body.sku} already exists (${duplicate.name}). Use a different SKU or the existing item.`;
    const spec = [body.size, body.material, body.finish, body.color].filter(Boolean).join(", ") || "-";
    return { id, kind: "product", title: `New item ${body.sku}`, summary: [["SKU", String(body.sku)], ["Name", String(body.name)], ["Category", String(body.category)], ["Type", String(body.productType)], ["Unit", String(body.unit)], ["Specification", String(spec)], ["Price", `Rs ${money(Number(body.unitPrice))}`], ["Minimum stock", money(Number(body.minimumStock))]], method: "POST", endpoint: "/api/products", body, permission, openPath: "/products" };
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
      summary.push([item ? `${item.sku} ${item.name}` : String(line.productName), `${lineAmount(line)} (${item?.unit ?? line.unit})`]);
    }
    return { id, kind: "sales_order", title: `Draft sales order for ${customer.name}`, summary, method: "POST", endpoint: "/api/sales/orders", body, permission, openPath: "/sales/orders" };
  }

  if (name === "propose_purchase_requisition") {
    const lines = (input.lines as Json[] | undefined ?? []).map((line) => ({ productId: line.productId, quantity: line.quantity, notes: line.notes ?? "" }));
    const plannedOrderIds = ((input.plannedOrderIds as unknown[] | undefined) ?? []).map(String);
    const body = { neededBy: input.neededBy ?? "", notes: input.notes ?? "", lines, plannedOrderIds, idempotencyKey: id };
    const problem = validate(requisitionInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    const products = await productNames(lines.map((line) => String(line.productId)));
    const missing = lines.find((line) => !products.has(String(line.productId)));
    if (missing) return `Not valid: product ${missing.productId} was not found. Use find_products.`;
    const suggestions = plannedOrderIds.length ? await buySuggestions() : [];
    const unknown = plannedOrderIds.find((plannedId) => !suggestions.some((row) => row.id === plannedId));
    if (unknown) return `Not valid: ${unknown} is not an open MRP buy suggestion. Use list_buy_suggestions.`;
    const summary: Array<[string, string]> = [["Needed by", String(body.neededBy || "-")]];
    for (const line of lines) {
      const item = products.get(String(line.productId))!;
      summary.push([`${item.sku} ${item.name}`, `${money(Number(line.quantity))} ${item.unit}`]);
    }
    for (const plannedId of plannedOrderIds) {
      const row = suggestions.find((item) => item.id === plannedId)!;
      summary.push([`${row.sku} ${row.productName} (MRP ${row.runNumber})`, `${money(Number(row.quantity))} ${row.unit}`]);
    }
    return { id, kind: "requisition", title: "Draft purchase requisition", summary, method: "POST", endpoint: "/api/procurement/requisitions", body, permission, openPath: "/procurement/requisitions" };
  }

  if (name === "propose_purchase_order") {
    const lines = (input.lines as Json[] | undefined ?? []).map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent ?? 0, taxPercent: line.taxPercent ?? 0 }));
    const body = { supplierId: input.supplierId, orderDate: input.orderDate, expectedDate: input.expectedDate ?? "", notes: input.notes ?? "", lines, idempotencyKey: id };
    const problem = validate(purchaseOrderInputSchema as SchemaLike, body);
    if (problem) return `Not valid: ${problem}`;
    const supplier = await db.orm.public.Supplier.where({ id: String(body.supplierId) }).first();
    if (!supplier) return "Not valid: supplierId was not found. Use find_suppliers.";
    const products = await productNames(lines.map((line) => String(line.productId)));
    const missing = lines.find((line) => !products.has(String(line.productId)));
    if (missing) return `Not valid: product ${missing.productId} was not found. Use find_products.`;
    const summary: Array<[string, string]> = [["Supplier", `${supplier.name} (${supplier.code})`], ["Order date", String(body.orderDate)], ["Expected", String(body.expectedDate || "-")]];
    for (const line of lines) {
      const item = products.get(String(line.productId))!;
      summary.push([`${item.sku} ${item.name}`, `${lineAmount(line)} (${item.unit})`]);
    }
    return { id, kind: "purchase_order", title: `Draft purchase order to ${supplier.name}`, summary, method: "POST", endpoint: "/api/procurement/purchase-orders", body, permission, openPath: "/procurement/purchase-orders" };
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

async function lookup(name: string, input: Json): Promise<unknown> {
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
  if (name === "list_buy_suggestions") {
    return (await buySuggestions()).map((row) => ({ id: row.id, sku: row.sku, product: row.productName, quantity: row.quantity, unit: row.unit, dueDate: row.dueDate, mrpRun: row.runNumber }));
  }
  return `Unknown tool ${name}.`;
}

const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

async function showReport(input: Json, user: User): Promise<ToolOutcome> {
  const key = String(input.report ?? "");
  const report = REPORTS[key];
  if (!report) return { error: `Unknown report "${key}".` };
  if (!allowed(user, report.permissions)) return { error: "The user's role does not allow this report." };
  const result = await runReport(key, { from: isDate(input.from) ? String(input.from) : undefined, to: isDate(input.to) ? String(input.to) : undefined });
  const words = String(input.search ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = words.length
    ? result.rows.filter((row) => {
      const haystack = Object.values(row).join(" ").toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    : result.rows;
  const query = new URLSearchParams({ format: "csv", ...(result.from ? { from: result.from } : {}), ...(result.to ? { to: result.to } : {}) });
  const columns = result.columns.map((column) => ({ key: column.key, label: column.label, type: column.type }));
  // Totals follow the rows shown, so a filtered table never shows the unfiltered total.
  const totals = words.length ? Object.fromEntries(Object.keys(result.totals).map((column) => [column, matching.reduce((sum, row) => (row[column] ? addDecimalStrings(sum, String(row[column])) : sum), "0")])) : result.totals;
  const table: ReportTable = {
    id: randomUUID(), report: key, title: result.title, description: result.description, from: result.from, to: result.to,
    columns, rows: matching.slice(0, MAX_TABLE_ROWS), totals, totalRows: matching.length, truncated: matching.length > MAX_TABLE_ROWS,
    csvPath: `/api/reports/${key}?${query.toString()}`,
  };
  return {
    table,
    result: {
      shownToUser: true, title: table.title, period: result.from ? `${result.from} to ${result.to}` : "current", rowCount: matching.length,
      columns: columns.map((column) => column.label), totals, rows: matching.slice(0, MODEL_SAMPLE_ROWS),
      note: matching.length > MODEL_SAMPLE_ROWS ? `Only the first ${MODEL_SAMPLE_ROWS} rows are included here; the user sees up to ${MAX_TABLE_ROWS}.` : undefined,
    },
  };
}

/* Runs one tool for this user. The permission check here is the one that counts. */
export async function executeTool(name: string, rawInput: unknown, user: User): Promise<ToolOutcome> {
  if (!TOOL_PERMISSIONS[name] || !allowed(user, TOOL_PERMISSIONS[name])) return { error: "The user's role does not allow this." };
  const input = (rawInput && typeof rawInput === "object" ? rawInput : {}) as Json;
  try {
    if (name === "show_report") return await showReport(input, user);
    if (name.startsWith("propose_")) {
      const outcome = await propose(name, input, user);
      return typeof outcome === "string" ? { error: outcome } : { proposal: outcome };
    }
    return { result: await lookup(name, input) };
  } catch (error) {
    return { error: `The lookup failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
