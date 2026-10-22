"use client";

import Link from "next/link";

import "@/components/inventory/InventoryWorkspace.css";

/* Every report runs live against the operational records and exports to CSV (D-028). */
const REPORT_GROUPS = [
  { title: "Orders & Sales", reports: [["/reports/orders", "Order fulfilment", "Ordered, shipped, delivered and invoiced per order"], ["/reports/delivery", "Deliveries", "Delivered shipments and on-time performance"]] },
  {
    title: "Production",
    reports: [
      ["/reports/production", "Production orders", "Status, stage and output per order"],
      ["/reports/production/stages", "Stage-wise production", "Input, accepted and losses by stage"],
      ["/reports/production/completion", "Production completion", "Completed orders, lateness and lead time"],
      ["/reports/production/wastage", "Wastage", "Wastage by stage and item"],
      ["/reports/production/rejections", "Rejections & rework", "Rejected and rework quantities by stage and item"],
    ],
  },
  { title: "Quality", reports: [["/reports/quality", "Quality inspections", "Approved inspections and pass rates"]], missing: "NCR and CAPA reports are not available: those records are not implemented yet." },
  {
    title: "Inventory",
    reports: [
      ["/reports/inventory", "Stock position", "On hand, reserved, held and available by location"],
      ["/reports/inventory/movements", "Stock movements", "Every ledger movement in a period"],
      ["/reports/inventory/wip", "Work-in-progress stock", "Stock in WIP warehouses"],
      ["/reports/inventory/finished-goods", "Finished goods stock", "Stock in finished-goods warehouses"],
    ],
  },
  { title: "Packing & Dispatch", reports: [["/reports/packing", "Packing", "Confirmed packing lists"], ["/reports/dispatch", "Dispatches", "Shipments dispatched in a period"]] },
  { title: "Finance", reports: [["/reports/receivables", "Receivables by invoice", "Outstanding issued invoices"], ["/finance/receivables", "Receivables ageing", "Outstanding by customer and age"]] },
  { title: "People", reports: [["/people-payroll/reports", "Payroll summary", "Approved payroll by month and department (payroll staff only)"]] },
];

export default function ReportsPage() {
  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Reporting</p>
          <h1>Reports</h1>
          <p>Every report is calculated from live records when it is opened, can be filtered by date and exported to CSV. A report opens only for users allowed to see its module.</p>
        </div>
      </header>
      {REPORT_GROUPS.map((group) => (
        <section key={group.title} className="inv-card">
          <div className="inv-card__header"><h2>{group.title}</h2></div>
          <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
            {group.reports.map(([href, label, description]) => <li key={href}><Link href={href}><strong>{label}</strong></Link> · {description}</li>)}
            {group.missing && <li>{group.missing}</li>}
          </ul>
        </section>
      ))}
    </main>
  );
}

