"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { usePathname } from "next/navigation";

import "./Breadcrumbs.css";

const LABELS = {
  dashboard: "Dashboard",

  sales: "Sales & CRM",
  customers: "Customers",
  enquiries: "Enquiries",
  quotations: "Quotations",
  orders: "Orders",
  "follow-ups": "Follow-ups",

  products: "Products",
  categories: "Categories",
  variants: "Variants",
  bom: "Bill of Materials",
  pricing: "Pricing",
  documents: "Documents",

  procurement: "Procurement",
  suppliers: "Suppliers",
  requisitions: "Requisitions",
  rfqs: "RFQs",
  "purchase-orders": "Purchase Orders",
  "goods-receipt": "Goods Receipt",

  inventory: "Inventory",
  overview: "Overview",
  "raw-materials": "Raw Materials",
  components: "Components",
  wip: "Work in Progress",
  "finished-goods": "Finished Goods",
  warehouses: "Warehouses",
  locations: "Locations",
  transfers: "Transfers",
  adjustments: "Adjustments",
  "stock-counts": "Stock Counts",
  "item-master": "Item Master",
  "wip-stock": "WIP Stock",
  reservations: "Reservations",
  ledger: "Stock Ledger",

  planning: "Planning / MRP",
  demand: "Demand",
  mrp: "MRP",
  shortages: "Material Shortages",
  "production-planning": "Production Planning",
  capacity: "Capacity",

  production: "Production",
  "work-orders": "Work Orders",
  scheduling: "Scheduling",
  "work-centers": "Work Centers",
  machines: "Machines",
  operations: "Operations",
  consumption: "Material Consumption",
  output: "Production Output",
  scrap: "Scrap",
  downtime: "Downtime",
  "stage-board": "Stage Board",
  "material-issue": "Material Issue",
  "shop-floor": "Shop Floor",
  schedule: "Production Schedule",
  completion: "Production Completion",
  "item-master": "Item Master",
  stock: "Stock",
  "wip-stock": "WIP Stock",
  "finished-goods": "Finished Goods",
  movements: "Movements",
  reservations: "Reservations",
  "batches-lots": "Batches & Lots",
  "low-stock": "Low Stock / Reorder",
  "material-requirements": "Material Requirements",
  "material-reservations": "Material Reservations",
  "mrp-runs": "MRP Runs",
  "production-plans": "Production Plans",
  "production-planning": "Production Planning",
  calendar: "Calendar",

  quality: "Quality Control",
  incoming: "Incoming Inspection",
  "in-process": "In-Process Inspection",
  final: "Final Inspection",
  inspections: "Inspections",
  ncr: "NCR",
  capa: "CAPA",
  rejections: "Rejections",

  dispatch: "Dispatch & Logistics",
  ready: "Ready for Delivery",
  delivered: "Delivered",
  picking: "Picking",
  packing: "Packing",
  shipments: "Shipments",
  carriers: "Carriers",
  tracking: "Tracking",

  gate: "Gate Management",
  "gate-in": "Gate In",
  "gate-out": "Gate Out",
  "gate-passes": "Gate Passes",
  visitors: "Visitors",
  vehicles: "Vehicles",
  history: "Gate History",

  finance: "Finance",
  accounts: "Accounts",
  income: "Income",
  invoices: "Invoices",
  "tax-invoices": "Tax Invoices",
  "sales-invoices": "Sales Invoices",
  "purchase-invoices": "Purchase Invoices",
  "credit-notes": "Credit Notes",
  "debit-notes": "Debit Notes",
  receivables: "Receivables",
  payables: "Payables",
  payments: "Payments",
  expenses: "Expenses",
  "cash-bank": "Cash & Bank",
  transactions: "Transactions",
  costing: "Costing",
  profitability: "Profitability",

  people: "People & Payroll",
  employees: "Employees",
  departments: "Departments",
  attendance: "Attendance",
  shifts: "Shifts",
  leave: "Leave",
  "salary-structures": "Salary Structures",
  payroll: "Payroll",
  advances: "Advances",
  loans: "Loans",
  overtime: "Overtime",
  payslips: "Payslips",

  reports: "Reports & Analytics",

  administration: "Administration",
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
  approvals: "Approvals",
  notifications: "Notifications",
  audit: "Audit Log",
  tax: "Tax Configuration",
  settings: "Settings",
};

function formatSegment(segment) {
  if (!segment) {
    return "";
  }

  if (LABELS[segment]) {
    return LABELS[segment];
  }

  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Breadcrumbs({
  items = [],
  className = "",
  currentLabel,
}) {
  const pathname = usePathname();

  const pathSegments = pathname
    .split("/")
    .filter(Boolean);

  const generatedItems = pathSegments.map(
    (segment, index) => {
      const href =
        "/" + pathSegments.slice(0, index + 1).join("/");

      return {
        label:
          segment === "reports" &&
          pathSegments[index - 1] === "finance"
            ? "Financial Reports"
            : formatSegment(segment),
        href,
      };
    }
  );

  const breadcrumbItems =
    items.length > 0
      ? items
      : generatedItems;

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav
      className={`erp-breadcrumbs ${className}`}
      aria-label="Breadcrumb"
    >
      <Link
        href="/dashboard"
        className="erp-breadcrumbs__home"
        aria-label="Dashboard"
      >
        <Home size={14} strokeWidth={2} />
      </Link>

      {breadcrumbItems.map((item, index) => {
        const isLast =
          index === breadcrumbItems.length - 1;

        const label =
          isLast && currentLabel
            ? currentLabel
            : item.label;

        return (
          <div
            key={`${item.href || item.label}-${index}`}
            className="erp-breadcrumbs__item"
          >
            <ChevronRight
              className="erp-breadcrumbs__separator"
              size={14}
              strokeWidth={1.8}
            />

            {isLast || !item.href ? (
              <span
                className="erp-breadcrumbs__current"
                aria-current={isLast ? "page" : undefined}
              >
                {label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="erp-breadcrumbs__link"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}