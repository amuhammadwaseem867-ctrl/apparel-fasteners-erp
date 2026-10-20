/*
 * The ERP menu (D-038), shared by the sidebar, the top bar's page title
 * and its search.
 */

import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

/*
 * Simple navigation (D-038): the factory's own flow, in order, from the
 * order sheet to the payment, then stock, purchasing and people. Pages left
 * out of this menu still work by link (and from the Order Profile); they
 * are only hidden to keep the menu short.
 */
export const NAV_GROUPS = [
  {
    title: "Home",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Order to delivery",
    items: [
      {
        label: "1. Orders",
        href: "/sales/orders",
        icon: ShoppingCart,
        children: [
          { label: "All orders", href: "/sales/orders" },
          { label: "New order", href: "/sales/orders/new" },
          { label: "Customers", href: "/sales/customers" },
        ],
      },
      {
        label: "2. Production",
        href: "/production",
        icon: Factory,
        children: [
          { label: "Production orders", href: "/production/orders" },
          { label: "Stage board", href: "/production/stage-board" },
          { label: "Issue raw material", href: "/production/material-issue" },
        ],
      },
      { label: "3. Quality check", href: "/quality/inspections", icon: ClipboardCheck },
      { label: "4. Packing", href: "/packing/orders", icon: Package },
      {
        label: "5. Dispatch",
        href: "/dispatch",
        icon: Truck,
        children: [
          { label: "Shipments", href: "/dispatch/shipments" },
          { label: "Gate passes", href: "/dispatch/gate-passes" },
        ],
      },
      {
        label: "6. Invoice & payment",
        href: "/finance",
        icon: Receipt,
        children: [
          { label: "Invoices", href: "/finance/invoices" },
          { label: "Payments received", href: "/finance/payments" },
          { label: "Customer balances", href: "/finance/receivables" },
        ],
      },
    ],
  },
  {
    title: "Stock & buying",
    items: [
      {
        label: "Inventory",
        href: "/inventory",
        icon: Boxes,
        children: [
          { label: "Raw material stock", href: "/inventory/raw-material" },
          { label: "Items", href: "/inventory/item-master" },
          { label: "Stock by location", href: "/inventory/stock" },
          { label: "Warehouses & shelves", href: "/inventory/warehouses" },
          { label: "Movement history", href: "/inventory/movements" },
        ],
      },
      {
        label: "Purchasing",
        href: "/procurement",
        icon: ClipboardList,
        children: [
          { label: "Suppliers", href: "/procurement/suppliers" },
          { label: "Purchase orders", href: "/procurement/purchase-orders" },
          { label: "Goods received", href: "/procurement/goods-receipts" },
          { label: "Supplier bills", href: "/finance/payables" },
        ],
      },
    ],
  },
  {
    title: "People & reports",
    items: [
      {
        label: "HR & Payroll",
        href: "/people-payroll",
        icon: Users,
        children: [
          { label: "Employees", href: "/people-payroll/employees" },
          { label: "Attendance", href: "/people-payroll/attendance" },
          { label: "Leave", href: "/people-payroll/leave" },
          { label: "Payroll", href: "/people-payroll/payroll" },
        ],
      },
      { label: "Reports", href: "/reports", icon: BarChart3 },
      {
        label: "Settings",
        href: "/administration",
        icon: Settings,
        children: [
          { label: "Users", href: "/administration/users" },
          { label: "Company & documents", href: "/administration/settings" },
        ],
      },
    ],
  },
];


/* Every menu page as { label, href, group, parent }, numbering removed. */
export const NAV_PAGES = NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => {
  const label = item.label.replace(/^\d+\.\s*/, "");
  const own = { label, href: item.href, group: group.title, parent: null, icon: item.icon };
  const children = (item.children ?? []).map((child) => ({ label: child.label, href: child.href, group: group.title, parent: label, icon: item.icon }));
  return [own, ...children];
}));

/* The menu entry a path belongs to (longest matching prefix). */
export function navEntryFor(pathname) {
  let best = null;
  for (const page of NAV_PAGES) {
    const match = pathname === page.href || (page.href !== "/dashboard" && pathname.startsWith(`${page.href}/`));
    if (match && (!best || page.href.length > best.href.length)) best = page;
  }
  return best;
}
