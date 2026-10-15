/*
 * Reports from live data (D-028). Each report is one read-only SQL query
 * over the operational tables, returned as typed columns and rows so the
 * same result renders as a table or exports as CSV. Quantities and money
 * stay exact decimal strings; totals are summed exactly on the server.
 * Nothing is estimated or sampled.
 */

import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { addDecimalStrings, normalizeDecimalString } from "../core/utils/decimal";

export type ColumnType = "text" | "number" | "money" | "date" | "datetime" | "percent";

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
  total?: boolean;
  /* Optional link template, e.g. "/production/orders/{id}". */
  href?: string;
}

export interface ReportDefinition {
  title: string;
  description: string;
  permissions: string[];
  dated: boolean;
  columns: ReportColumn[];
  query: (range: { from: string; to: string }) => unknown;
  note?: string;
}

const text = (key: string, label: string, href?: string): ReportColumn => ({ key, label, type: "text", href });
const number = (key: string, label: string, total = true): ReportColumn => ({ key, label, type: "number", total });
const money = (key: string, label: string, total = true): ReportColumn => ({ key, label, type: "money", total });
const date = (key: string, label: string): ReportColumn => ({ key, label, type: "date" });
const datetime = (key: string, label: string): ReportColumn => ({ key, label, type: "datetime" });
const percent = (key: string, label: string): ReportColumn => ({ key, label, type: "percent" });

/* Every report column is read as text; numbers stay exact. */
function plan(sql: ReturnType<typeof db.raw.sql>, columns: ReportColumn[], extra: string[] = []) {
  const shape = Object.fromEntries([...columns.map((column) => column.key), ...extra].map((key) => [key, "pg/text@1"]));
  return sql.returnsRow(shape as never).build();
}

/* Upper bound for timestamp ranges: the day after `to`. */
const dayAfter = (value: string) => new Date(Date.parse(`${value}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

const VIEW_OR_REPORTS = (module: string) => [`${module}:view`, "reports:view"];

export const REPORTS: Record<string, ReportDefinition> = {
  orders: {
    title: "Order Fulfilment",
    description: "Sales orders dated in the period with ordered, shipped and delivered quantities (catalogue lines) and invoiced value.",
    permissions: VIEW_OR_REPORTS("sales"),
    dated: true,
    columns: [
      text("orderNumber", "Order", "/sales/orders/{id}"), date("orderDate", "Order date"), date("deliveryDate", "Due"), text("customer", "Customer"),
      text("status", "Status"), money("orderTotal", "Order value"), number("ordered", "Qty ordered"), number("shipped", "Qty shipped"),
      number("delivered", "Qty delivered"), percent("fulfilled", "Shipped %"), money("invoiced", "Invoiced"),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select so.id::text as id, so."orderNumber", so."orderDate", coalesce(so."deliveryDate", '') as "deliveryDate", c.name as customer, so.status,
        so."totalAmount"::text as "orderTotal",
        coalesce(l.ordered, 0)::text as ordered, coalesce(sh.shipped, 0)::text as shipped, coalesce(sh.delivered, 0)::text as delivered,
        case when coalesce(l.ordered, 0) = 0 then '' else round(coalesce(sh.shipped, 0) * 100 / l.ordered, 1)::text end as fulfilled,
        coalesce(inv.total, 0)::text as invoiced
      from erp_sales_orders so
      join erp_customers c on c.id = so."customerId"
      left join (select "salesOrderId", sum(quantity) as ordered from erp_sales_order_lines where "productId" is not null and not "isCustom" group by 1) l on l."salesOrderId" = so.id
      left join (select s."salesOrderId", sum(sl.quantity) as shipped, sum(case when s.status = 'DELIVERED' then sl.quantity else 0 end) as delivered
                 from erp_shipments s join erp_shipment_lines sl on sl."shipmentId" = s.id where s.status in ('DISPATCHED', 'DELIVERED') group by 1) sh on sh."salesOrderId" = so.id
      left join (select "salesOrderId", sum("totalAmount") as total from erp_invoices where status = 'ISSUED' group by 1) inv on inv."salesOrderId" = so.id
      where so."orderDate" between ${from} and ${to}
      order by so."orderDate", so."orderNumber"
    `, REPORTS.orders.columns, ["id"]),
  },
  delivery: {
    title: "Deliveries",
    description: "Shipments confirmed delivered in the period, against the sales order's due date.",
    permissions: VIEW_OR_REPORTS("dispatch"),
    dated: true,
    columns: [
      text("shipmentNumber", "Shipment", "/dispatch/shipments/{id}"), text("orderNumber", "Sales order"), text("customer", "Customer"),
      datetime("dispatchedAt", "Dispatched"), datetime("deliveredAt", "Delivered"), date("dueDate", "Due"), text("onTime", "On time"),
      text("receivedBy", "Received by"), number("quantity", "Quantity"),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select s.id::text as id, s."shipmentNumber", so."orderNumber", c.name as customer, coalesce(s."dispatchedAt"::text, '') as "dispatchedAt",
        coalesce(s."deliveredAt"::text, '') as "deliveredAt", coalesce(so."deliveryDate", '') as "dueDate",
        case when so."deliveryDate" is null then 'No due date' when s."deliveredAt"::date <= so."deliveryDate"::date then 'Yes' else 'Late' end as "onTime",
        coalesce(s."receivedBy", '') as "receivedBy",
        (select coalesce(sum(quantity), 0) from erp_shipment_lines where "shipmentId" = s.id)::text as quantity
      from erp_shipments s join erp_sales_orders so on so.id = s."salesOrderId" join erp_customers c on c.id = s."customerId"
      where s.status = 'DELIVERED' and s."deliveredAt" >= ${from}::date and s."deliveredAt" < ${dayAfter(to)}::date
      order by s."deliveredAt"
    `, REPORTS.delivery.columns, ["id"]),
  },
  dispatch: {
    title: "Dispatches",
    description: "Shipments dispatched in the period (in transit or delivered).",
    permissions: VIEW_OR_REPORTS("dispatch"),
    dated: true,
    columns: [
      text("shipmentNumber", "Shipment", "/dispatch/shipments/{id}"), text("orderNumber", "Sales order"), text("customer", "Customer"),
      datetime("dispatchedAt", "Dispatched"), text("status", "Status"), text("vehicle", "Vehicle"), text("transporter", "Transporter"),
      number("lines", "Lines"), number("quantity", "Quantity"),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select s.id::text as id, s."shipmentNumber", so."orderNumber", c.name as customer, coalesce(s."dispatchedAt"::text, '') as "dispatchedAt", s.status,
        coalesce(s."vehicleNumber", '') as vehicle, coalesce(s.transporter, '') as transporter,
        (select count(*) from erp_shipment_lines where "shipmentId" = s.id)::text as lines,
        (select coalesce(sum(quantity), 0) from erp_shipment_lines where "shipmentId" = s.id)::text as quantity
      from erp_shipments s join erp_sales_orders so on so.id = s."salesOrderId" join erp_customers c on c.id = s."customerId"
      where s.status in ('DISPATCHED', 'DELIVERED') and s."dispatchedAt" >= ${from}::date and s."dispatchedAt" < ${dayAfter(to)}::date
      order by s."dispatchedAt"
    `, REPORTS.dispatch.columns, ["id"]),
  },
  packing: {
    title: "Packing",
    description: "Packing lists confirmed in the period: packed quantity received into finished goods.",
    permissions: VIEW_OR_REPORTS("production"),
    dated: true,
    columns: [
      text("packingNumber", "Packing list", "/packing/orders/{id}"), datetime("confirmedAt", "Confirmed"), text("orderNumber", "Production order"),
      text("sku", "Item"), text("salesOrder", "Sales order"), number("packages", "Packages"), number("quantity", "Quantity"), text("status", "Status"),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select p.id::text as id, p."packingNumber", coalesce(p."confirmedAt"::text, '') as "confirmedAt", po."orderNumber", pr.sku,
        coalesce(so."orderNumber", 'Stock') as "salesOrder", p."packageCount"::text as packages, p."totalQuantity"::text as quantity, p.status
      from erp_packing_lists p join erp_production_orders po on po.id = p."productionOrderId" join erp_products pr on pr.id = p."productId"
      left join erp_sales_orders so on so.id = p."salesOrderId"
      where p.status in ('CONFIRMED', 'SHIPPED') and p."confirmedAt" >= ${from}::date and p."confirmedAt" < ${dayAfter(to)}::date
      order by p."confirmedAt"
    `, REPORTS.packing.columns, ["id"]),
  },
  production: {
    title: "Production Orders",
    description: "Production orders created in the period with status, current stage and output.",
    permissions: VIEW_OR_REPORTS("production"),
    dated: true,
    columns: [
      text("orderNumber", "Order", "/production/orders/{id}"), date("created", "Created"), text("sku", "Item"), number("quantity", "Quantity"),
      text("priority", "Priority"), date("dueDate", "Due"), text("status", "Status"), text("currentStage", "Current stage"),
      number("stagesDone", "Stages done", false), number("delivered", "Delivered"), number("rejected", "Rejected"), number("wastage", "Wastage"),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select o.id::text as id, o."orderNumber", o."createdAt"::date::text as created, p.sku, o.quantity::text as quantity, o.priority,
        coalesce(o."dueDate", '') as "dueDate", o.status, case when o.status = 'COMPLETED' then '' else coalesce(o."currentStage", '') end as "currentStage",
        (select count(*) from erp_production_stages s where s."productionOrderId" = o.id and s.status = 'COMPLETED')::text as "stagesDone",
        coalesce((select "acceptedQuantity" from erp_production_stages s where s."productionOrderId" = o.id and s.sequence = 9), 0)::text as delivered,
        (select coalesce(sum("rejectedQuantity"), 0) from erp_production_stages s where s."productionOrderId" = o.id)::text as rejected,
        (select coalesce(sum("wastageQuantity"), 0) from erp_production_stages s where s."productionOrderId" = o.id)::text as wastage
      from erp_production_orders o join erp_products p on p.id = o."productId"
      where o."createdAt" >= ${from}::date and o."createdAt" < ${dayAfter(to)}::date
      order by o."createdAt"
    `, REPORTS.production.columns, ["id"]),
  },
  "production-stages": {
    title: "Stage-wise Production",
    description: "Output recorded at each stage in the period (from stage runs), with losses.",
    permissions: VIEW_OR_REPORTS("production"),
    dated: true,
    columns: [
      number("sequence", "#", false), text("stage", "Stage"), number("runs", "Runs"), number("input", "Input"), number("accepted", "Accepted"),
      number("rejected", "Rejected"), number("wastage", "Wastage"), number("rework", "Rework"), percent("lossRate", "Loss %"),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select s.sequence::text as sequence, s."stageKey" as stage, count(r.id)::text as runs,
        coalesce(sum(r."inputQuantity"), 0)::text as input, coalesce(sum(r."acceptedQuantity"), 0)::text as accepted,
        coalesce(sum(r."rejectedQuantity"), 0)::text as rejected, coalesce(sum(r."wastageQuantity"), 0)::text as wastage,
        coalesce(sum(r."reworkQuantity"), 0)::text as rework,
        case when coalesce(sum(r."inputQuantity"), 0) = 0 then '' else round((sum(r."rejectedQuantity") + sum(r."wastageQuantity")) * 100 / sum(r."inputQuantity"), 1)::text end as "lossRate"
      from erp_production_stage_runs r join erp_production_stages s on s.id = r."stageId"
      where r."recordedAt" >= ${from}::date and r."recordedAt" < ${dayAfter(to)}::date
      group by s.sequence, s."stageKey" order by s.sequence
    `, REPORTS["production-stages"].columns),
  },
  "production-completion": {
    title: "Production Completion",
    description: "Orders completed in the period against their due dates.",
    permissions: VIEW_OR_REPORTS("production"),
    dated: true,
    columns: [
      text("orderNumber", "Order", "/production/orders/{id}"), text("sku", "Item"), number("quantity", "Ordered"), number("delivered", "Delivered"),
      date("dueDate", "Due"), datetime("completedAt", "Completed"), number("daysLate", "Days late", false), number("leadDays", "Lead time (days)", false),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select o.id::text as id, o."orderNumber", p.sku, o.quantity::text as quantity,
        coalesce((select "acceptedQuantity" from erp_production_stages s where s."productionOrderId" = o.id and s.sequence = 9), 0)::text as delivered,
        coalesce(o."dueDate", '') as "dueDate", o."completedAt"::text as "completedAt",
        case when o."dueDate" is null then '' else greatest(0, o."completedAt"::date - o."dueDate"::date)::text end as "daysLate",
        (o."completedAt"::date - o."createdAt"::date)::text as "leadDays"
      from erp_production_orders o join erp_products p on p.id = o."productId"
      where o.status = 'COMPLETED' and o."completedAt" >= ${from}::date and o."completedAt" < ${dayAfter(to)}::date
      order by o."completedAt"
    `, REPORTS["production-completion"].columns, ["id"]),
  },
  "production-wastage": {
    title: "Wastage",
    description: "Wastage recorded in stage runs in the period, by stage and item.",
    permissions: VIEW_OR_REPORTS("production"),
    dated: true,
    columns: [text("stage", "Stage"), text("sku", "Item"), number("runs", "Runs"), number("input", "Input"), number("wastage", "Wastage"), percent("rate", "Wastage %")],
    query: ({ from, to }) => plan(db.raw.sql`
      select s."stageKey" as stage, p.sku, count(r.id)::text as runs, sum(r."inputQuantity")::text as input, sum(r."wastageQuantity")::text as wastage,
        round(sum(r."wastageQuantity") * 100 / sum(r."inputQuantity"), 1)::text as rate
      from erp_production_stage_runs r join erp_production_stages s on s.id = r."stageId"
      join erp_production_orders o on o.id = s."productionOrderId" join erp_products p on p.id = o."productId"
      where r."wastageQuantity" > 0 and r."recordedAt" >= ${from}::date and r."recordedAt" < ${dayAfter(to)}::date
      group by s.sequence, s."stageKey", p.sku order by sum(r."wastageQuantity") desc
    `, REPORTS["production-wastage"].columns),
  },
  "production-rejections": {
    title: "Rejections & Rework",
    description: "Rejected and rework quantities from stage runs in the period, by stage and item.",
    permissions: VIEW_OR_REPORTS("production"),
    dated: true,
    columns: [text("stage", "Stage"), text("sku", "Item"), number("runs", "Runs"), number("input", "Input"), number("rejected", "Rejected"), number("rework", "Rework"), percent("rate", "Rejected %")],
    query: ({ from, to }) => plan(db.raw.sql`
      select s."stageKey" as stage, p.sku, count(r.id)::text as runs, sum(r."inputQuantity")::text as input,
        sum(r."rejectedQuantity")::text as rejected, sum(r."reworkQuantity")::text as rework,
        round(sum(r."rejectedQuantity") * 100 / sum(r."inputQuantity"), 1)::text as rate
      from erp_production_stage_runs r join erp_production_stages s on s.id = r."stageId"
      join erp_production_orders o on o.id = s."productionOrderId" join erp_products p on p.id = o."productId"
      where (r."rejectedQuantity" > 0 or r."reworkQuantity" > 0) and r."recordedAt" >= ${from}::date and r."recordedAt" < ${dayAfter(to)}::date
      group by s.sequence, s."stageKey", p.sku order by sum(r."rejectedQuantity") desc
    `, REPORTS["production-rejections"].columns),
  },
  quality: {
    title: "Quality Inspections",
    description: "Inspections approved in the period, by type and item, with pass rates.",
    permissions: VIEW_OR_REPORTS("quality"),
    dated: true,
    columns: [
      text("type", "Type"), text("sku", "Item"), number("inspections", "Inspections"), number("inspected", "Inspected"), number("passed", "Passed"),
      number("rework", "Rework"), number("rejected", "Rejected"), percent("passRate", "Pass %"),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select q."inspectionType" as type, p.sku, count(*)::text as inspections, sum(q."inspectedQuantity")::text as inspected,
        sum(q."passedQuantity")::text as passed, sum(q."reworkQuantity")::text as rework, sum(q."rejectedQuantity")::text as rejected,
        round(sum(q."passedQuantity") * 100 / sum(q."inspectedQuantity"), 1)::text as "passRate"
      from erp_quality_inspections q join erp_products p on p.id = q."productId"
      where q.status = 'APPROVED' and q."decidedAt" >= ${from}::date and q."decidedAt" < ${dayAfter(to)}::date
      group by q."inspectionType", p.sku order by q."inspectionType", p.sku
    `, REPORTS.quality.columns),
  },
  inventory: {
    title: "Stock Position",
    description: "Current stock by item and location. Available = on hand − reserved − quality hold. No valuation: item costs are not recorded.",
    permissions: VIEW_OR_REPORTS("inventory"),
    dated: false,
    columns: [
      text("sku", "Item", "/inventory/item-master/{sku}"), text("name", "Description"), text("warehouse", "Warehouse"), text("location", "Location"),
      text("unit", "Unit"), number("onHand", "On hand"), number("reserved", "Reserved"), number("hold", "QC hold"), number("available", "Available"),
      number("minimum", "Minimum", false), text("belowMinimum", "Below minimum"),
    ],
    query: () => plan(db.raw.sql`
      select p.sku, p.name, w.code as warehouse, l.code as location, p.unit, b."onHand"::text as "onHand", b.reserved::text as reserved,
        b."qualityHold"::text as hold, (b."onHand" - b.reserved - b."qualityHold")::text as available, p."minimumStock"::text as minimum,
        case when p."minimumStock" > 0 and (select sum("onHand" - reserved - "qualityHold") from erp_stock_balances x where x."productId" = p.id) < p."minimumStock" then 'Yes' else '' end as "belowMinimum"
      from erp_stock_balances b join erp_products p on p.id = b."productId"
      join erp_storage_locations l on l.id = b."locationId" join erp_warehouses w on w.id = l."warehouseId"
      where b."onHand" <> 0 or b.reserved <> 0 or b."qualityHold" <> 0
      order by p.sku, w.code, l.code
    `, REPORTS.inventory.columns),
  },
  "inventory-movements": {
    title: "Stock Movements",
    description: "Every ledger movement in the period.",
    permissions: VIEW_OR_REPORTS("inventory"),
    dated: true,
    columns: [
      datetime("at", "When"), text("documentNumber", "Document", "/print/stock-documents/{documentId}"), text("type", "Type"), text("sku", "Item"),
      text("location", "Location"), text("bucket", "Bucket"), number("delta", "Quantity", false), number("balanceAfter", "Balance after", false),
    ],
    query: ({ from, to }) => plan(db.raw.sql`
      select m."createdAt"::text as at, d.id::text as "documentId", d."documentNumber", m."movementType" as type, p.sku,
        w.code || '/' || l.code as location, m.bucket, m."quantityDelta"::text as delta, m."balanceAfter"::text as "balanceAfter"
      from erp_stock_movements m join erp_stock_documents d on d.id = m."documentId" join erp_products p on p.id = m."productId"
      join erp_storage_locations l on l.id = m."locationId" join erp_warehouses w on w.id = l."warehouseId"
      where m."createdAt" >= ${from}::date and m."createdAt" < ${dayAfter(to)}::date
      order by m."createdAt", d."documentNumber", m."lineNo"
      limit 20000
    `, REPORTS["inventory-movements"].columns, ["documentId"]),
    note: "Up to 20,000 movements are listed; narrow the dates for longer periods.",
  },
  "inventory-wip": stockByWarehouseType("WIP", "Work-in-Progress Stock", "Material held in WIP warehouses (production floor)."),
  "inventory-finished-goods": stockByWarehouseType("FINISHED_GOODS", "Finished Goods Stock", "Stock in finished-goods warehouses, with what is reserved for orders."),
  receivables: {
    title: "Receivables by Invoice",
    description: "Issued invoices with an outstanding balance (total − credit notes − posted receipts).",
    permissions: VIEW_OR_REPORTS("finance"),
    dated: false,
    columns: [
      text("invoiceNumber", "Invoice", "/finance/invoices/{id}"), text("customer", "Customer"), date("invoiceDate", "Date"), date("dueDate", "Due"),
      number("daysOverdue", "Days overdue", false), money("total", "Total"), money("credited", "Credited"), money("received", "Received"), money("outstanding", "Outstanding"),
    ],
    query: () => plan(db.raw.sql`
      select * from (
        select i.id::text as id, i."invoiceNumber", c.name as customer, i."invoiceDate", i."dueDate",
          greatest(0, current_date - i."dueDate"::date)::text as "daysOverdue", i."totalAmount"::text as total,
          coalesce(cn.t, 0)::text as credited, coalesce(r.t, 0)::text as received,
          (i."totalAmount" - coalesce(cn.t, 0) - coalesce(r.t, 0))::text as outstanding
        from erp_invoices i join erp_customers c on c.id = i."customerId"
        left join (select "invoiceId", sum("totalAmount") as t from erp_credit_notes group by 1) cn on cn."invoiceId" = i.id
        left join (select "invoiceId", sum(amount) as t from erp_customer_receipts where status = 'POSTED' group by 1) r on r."invoiceId" = i.id
        where i.status = 'ISSUED'
      ) x where x.outstanding::numeric > 0
      order by x."dueDate", x."invoiceNumber"
    `, REPORTS.receivables.columns, ["id"]),
  },
  payroll: {
    title: "Payroll Summary",
    description: "Approved and paid payroll runs by month, with totals by department.",
    permissions: ["payroll:view"],
    dated: false,
    columns: [
      text("period", "Month", "/people-payroll/payroll/{id}"), text("status", "Status"), text("department", "Department"), number("employees", "Employees"),
      money("gross", "Gross"), money("deductions", "Deductions"), money("net", "Net pay"),
    ],
    query: () => plan(db.raw.sql`
      select r.id::text as id, r.period, r.status, d.name as department, count(l.id)::text as employees,
        sum(l."grossPay")::text as gross, sum(l."fixedDeduction" + l."advanceRecovery" + l."otherDeduction")::text as deductions, sum(l."netPay")::text as net
      from erp_payroll_runs r join erp_payroll_lines l on l."runId" = r.id join erp_employees e on e.id = l."employeeId" join erp_departments d on d.id = e."departmentId"
      where r.status in ('APPROVED', 'PAID')
      group by r.id, r.period, r.status, d.name order by r.period desc, d.name
    `, REPORTS.payroll.columns, ["id"]),
  },
};

function stockByWarehouseType(type: string, title: string, description: string): ReportDefinition {
  const columns = [
    text("sku", "Item"), text("name", "Description"), text("warehouse", "Warehouse"), text("location", "Location"), text("unit", "Unit"),
    number("onHand", "On hand"), number("reserved", "Reserved"), number("hold", "QC hold"), number("available", "Available"),
  ];
  return {
    title,
    description,
    permissions: VIEW_OR_REPORTS("inventory"),
    dated: false,
    columns,
    query: () => plan(db.raw.sql`
      select p.sku, p.name, w.code as warehouse, l.code as location, p.unit, b."onHand"::text as "onHand", b.reserved::text as reserved,
        b."qualityHold"::text as hold, (b."onHand" - b.reserved - b."qualityHold")::text as available
      from erp_stock_balances b join erp_products p on p.id = b."productId"
      join erp_storage_locations l on l.id = b."locationId" join erp_warehouses w on w.id = l."warehouseId"
      where w."warehouseType" = ${type} and b."onHand" <> 0
      order by p.sku, w.code, l.code
    `, columns),
  };
}

export function reportPermissions(key: string) {
  const report = REPORTS[key];
  if (!report) throw new AppError("Report not found.", { code: "REPORT_NOT_FOUND", status: 404 });
  return report.permissions;
}

export async function runReport(key: string, range: { from?: string; to?: string }) {
  const report = REPORTS[key];
  if (!report) throw new AppError("Report not found.", { code: "REPORT_NOT_FOUND", status: 404 });

  const to = range.to || new Date().toISOString().slice(0, 10);
  const from = range.from || new Date(Date.parse(`${to}T00:00:00Z`) - 89 * 86400000).toISOString().slice(0, 10);
  if (from > to) throw new AppError("The start date is after the end date.", { code: "REPORT_RANGE_INVALID", status: 400 });

  const rows = (await db.runtime().query(report.query({ from, to }) as never)) as unknown as Array<Record<string, string | null>>;
  const clean = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const column = report.columns.find((item) => item.key === key);
    if (value === null || value === "") return [key, ""];
    return [key, column && ["number", "money"].includes(column.type) ? normalizeDecimalString(value) : value];
  })));

  const totals: Record<string, string> = {};
  for (const column of report.columns.filter((item) => item.total)) {
    totals[column.key] = clean.reduce((sum, row) => (row[column.key] ? addDecimalStrings(sum, String(row[column.key])) : sum), "0");
  }

  return {
    key,
    title: report.title,
    description: report.description,
    note: report.note ?? null,
    dated: report.dated,
    from: report.dated ? from : null,
    to: report.dated ? to : null,
    columns: report.columns,
    rows: clean,
    totals,
    generatedAt: new Date().toISOString(),
  };
}
