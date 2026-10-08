"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Factory,
  GitBranch,
  LayoutDashboard,
  Lock,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
} from "lucide-react";

import "./Sidebar.css";

const NAV_GROUPS = [
  {
    title: "Command Center",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },

  {
    title: "Business",
    items: [
      {
        label: "Sales & CRM",
        href: "/sales",
        icon: BriefcaseBusiness,
        children: [
          {
            label: "Customers",
            href: "/sales/customers",
          },
          {
            label: "Orders",
            href: "/sales/orders",
          },
        ],
      },

      {
        label: "Products",
        href: "/products",
        icon: Package,
      },

      {
        label: "Procurement",
        href: "/procurement",
        icon: ShoppingCart,
        children: [
          {
            label: "Suppliers",
            href: "/procurement/suppliers",
          },
          {
            label: "Requisitions",
            href: "/procurement/requisitions",
          },
          {
            label: "RFQs",
            href: "/procurement/rfqs",
          },
          {
            label: "Purchase Orders",
            href: "/procurement/purchase-orders",
          },
          {
            label: "Goods Receipts",
            href: "/procurement/goods-receipts",
          },
          {
            label: "Supplier Performance",
            href: "/procurement/supplier-performance",
          },
        ],
      },
    ],
  },

  {
    title: "Materials & Inventory",
    items: [
      {
        label: "Inventory",
        href: "/inventory",
        icon: Boxes,
        children: [
          {
            label: "Overview",
            href: "/inventory",
          },
          {
            label: "Item Master",
            href: "/inventory/item-master",
          },
          {
            label: "Stock",
            href: "/inventory/stock",
          },
          {
            label: "WIP Stock",
            href: "/inventory/wip-stock",
          },
          {
            label: "Finished Goods",
            href: "/inventory/finished-goods",
          },
          {
            label: "Warehouses",
            href: "/inventory/warehouses",
          },
          {
            label: "Movements",
            href: "/inventory/movements",
          },
          {
            label: "Transfers",
            href: "/inventory/transfers",
          },
          {
            label: "Adjustments",
            href: "/inventory/adjustments",
          },
          {
            label: "Reservations",
            href: "/inventory/reservations",
          },
          {
            label: "Batches & Lots",
            href: "/inventory/batches-lots",
          },
          {
            label: "Stock Counts",
            href: "/inventory/stock-counts",
          },
        ],
      },

      {
        label: "Planning / MRP",
        href: "/planning",
        icon: GitBranch,
        children: [
          {
            label: "Overview",
            href: "/planning",
          },
          {
            label: "Material Requirements",
            href: "/planning/material-requirements",
          },
          {
            label: "MRP Runs",
            href: "/planning/mrp-runs",
          },
          {
            label: "Production Plans",
            href: "/planning/production-plans",
          },
          {
            label: "Material Reservations",
            href: "/planning/material-reservations",
          },
          {
            label: "Shortages",
            href: "/planning/shortages",
          },
          {
            label: "Capacity",
            href: "/planning/capacity",
          },
          {
            label: "Calendar",
            href: "/planning/calendar",
          },
        ],
      },

      /*
       * Production
       *
       * Lean operational structure:
       *
       * Production Plan
       *       ↓
       * Work Order
       *       ↓
       * Schedule
       *       ↓
       * Operations
       *       ↓
       * Material Issue
       *       ↓
       * Shop Floor
       *       ↓
       * Production Output
       *       ↓
       * Production Completion
       */
      {
        label: "Production",
        href: "/production",
        icon: Factory,
        children: [
          {
            label: "Overview",
            href: "/production",
          },
          {
            label: "Orders",
            href: "/production/orders",
          },
          {
            label: "Stage Board",
            href: "/production/stage-board",
          },
          {
            label: "Work Orders",
            href: "/production/work-orders",
          },
          {
            label: "Production Schedule",
            href: "/production/schedule",
          },
          {
            label: "Operations",
            href: "/production/operations",
          },
          {
            label: "Material Issue",
            href: "/production/material-issue",
          },
          {
            label: "Shop Floor",
            href: "/production/shop-floor",
          },
          {
            label: "Output",
            href: "/production/output",
          },
          {
            label: "Completion",
            href: "/production/completion",
          },
        ],
      },

      {
        label: "Quality Control",
        href: "/quality",
        icon: ClipboardCheck,
        children: [
          {
            label: "Overview",
            href: "/quality",
          },
          {
            label: "Incoming",
            href: "/quality/incoming",
          },
          {
            label: "In-Process",
            href: "/quality/in-process",
          },
          {
            label: "Final Inspection",
            href: "/quality/final",
          },
          {
            label: "Inspections",
            href: "/quality/inspections",
          },
          {
            label: "NCR",
            href: "/quality/ncr",
          },
          {
            label: "CAPA",
            href: "/quality/capa",
          },
          {
            label: "Rejections",
            href: "/quality/rejections",
          },
        ],
      },

      {
        label: "Packing",
        href: "/packing",
        icon: Package,
        children: [
          {
            label: "Overview",
            href: "/packing",
          },
          {
            label: "Packing Orders",
            href: "/packing/orders",
          },
          {
            label: "Packing Instructions",
            href: "/packing/instructions",
          },
          {
            label: "Packages",
            href: "/packing/packages",
          },
          {
            label: "Completed Packing",
            href: "/packing/completed",
          },
        ],
      },

      {
        label: "Dispatch & Logistics",
        href: "/dispatch",
        icon: Truck,
        children: [
          {
            label: "Overview",
            href: "/dispatch",
          },
          {
            label: "Ready for Delivery",
            href: "/dispatch/ready",
          },
          {
            label: "Dispatch",
            href: "/dispatch/dispatch",
          },
          {
            label: "Shipments",
            href: "/dispatch/shipments",
          },
          {
            label: "Delivered",
            href: "/dispatch/delivered",
          },
        ],
      },

    ],
  },

  {
    title: "Finance & People",
    items: [
      {
        label: "Finance",
        href: "/finance",
        icon: Receipt,
        children: [
          {
            label: "Overview",
            href: "/finance",
          },
          {
            label: "Accounts",
            href: "/finance/accounts",
          },
          {
            label: "Income",
            href: "/finance/income",
          },
          {
            label: "Expenses",
            href: "/finance/expenses",
          },
          {
            label: "Invoices",
            href: "/finance/invoices",
          },
          {
            label: "Payments",
            href: "/finance/payments",
          },
          {
            label: "Receivables",
            href: "/finance/receivables",
          },
          {
            label: "Payables",
            href: "/finance/payables",
          },
          {
            label: "Cash & Bank",
            href: "/finance/cash-bank",
          },
          {
            label: "Transactions",
            href: "/finance/transactions",
          },
          {
            label: "Financial Reports",
            href: "/finance/reports",
          },
        ],
      },

      {
        label: "People & Payroll",
        href: "/people-payroll",
        icon: Users,
        children: [
          {
            label: "Employees",
            href: "/people-payroll/employees",
          },
          {
            label: "Departments",
            href: "/people-payroll/departments",
          },
          {
            label: "Attendance",
            href: "/people-payroll/attendance",
          },
          {
            label: "Shifts",
            href: "/people-payroll/shifts",
          },
          {
            label: "Leave",
            href: "/people-payroll/leave",
          },
          {
            label: "Salary Structures",
            href: "/people-payroll/salary-structure",
          },
          {
            label: "Payroll",
            href: "/people-payroll/payroll",
          },
          {
            label: "Advances & Loans",
            href: "/people-payroll/advances-loans",
          },
          {
            label: "Deductions",
            href: "/people-payroll/deductions",
          },
          {
            label: "Payroll Reports",
            href: "/people-payroll/reports",
          },
        ],
      },
    ],
  },

  {
    title: "Reporting",
    items: [
      {
        label: "Reports & Analytics",
        href: "/reports",
        icon: BarChart3,
        children: [
          {
            label: "Overview",
            href: "/reports",
          },
          {
            label: "Orders",
            href: "/reports/orders",
          },
          {
            label: "Production",
            href: "/reports/production",
          },
          {
            label: "Quality",
            href: "/reports/quality",
          },
          {
            label: "Inventory",
            href: "/reports/inventory",
          },
          {
            label: "Packing",
            href: "/reports/packing",
          },
          {
            label: "Dispatch",
            href: "/reports/dispatch",
          },
        ],
      },
    ],
  },

  {
    title: "Administration",
    items: [
      {
        label: "Settings",
        href: "/administration",
        icon: Settings,
        children: [
          {
            label: "Users",
            href: "/administration/users",
          },
          {
            label: "Roles",
            href: "/administration/roles",
          },
          {
            label: "Audit Logs",
            href: "/administration/audit",
          },
          {
            label: "System Settings",
            href: "/administration/settings",
          },
        ],
      },
    ],
  },
];

function isRouteActive(pathname, href) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

function hasActiveChild(pathname, children = []) {
  return children.some((child) =>
    isRouteActive(pathname, child.href)
  );
}

export default function Sidebar({
  pinned,
  hovered,
  expanded,
  mobileOpen,
  setPinned,
  setHovered,
  setMobileOpen,
}) {
  const pathname = usePathname();

  const handleMobileNavigation = () => {
    if (window.innerWidth <= 900) {
      setMobileOpen(false);
    }
  };

  return (
    <aside
      className={[
        "erp-sidebar",
        expanded
          ? "erp-sidebar--expanded"
          : "erp-sidebar--collapsed",
        mobileOpen
          ? "erp-sidebar--mobile-open"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="erp-sidebar__header">
        <div className="erp-sidebar__brand">
          <div className="erp-sidebar__brand-mark">
            AF
          </div>

          <div className="erp-sidebar__brand-copy">
            <div className="erp-sidebar__brand-name">
              Apparel Fastener
            </div>

            <div className="erp-sidebar__brand-subtitle">
              Enterprise Resource Planning
            </div>
          </div>

          <button
            type="button"
            className="erp-sidebar__mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X
              size={18}
              strokeWidth={1.8}
            />
          </button>
        </div>
      </div>

      <nav
        className="erp-sidebar__nav"
        aria-label="ERP navigation"
      >
        {NAV_GROUPS.map((group) => (
          <div
            className="erp-sidebar__group"
            key={group.title}
          >
            <div className="erp-sidebar__section-title">
              {group.title}
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;

              const hasChildren =
                Array.isArray(item.children) &&
                item.children.length > 0;

              const active =
                isRouteActive(
                  pathname,
                  item.href
                ) ||
                hasActiveChild(
                  pathname,
                  item.children
                );

              return (
                <div
                  className="erp-sidebar__item-wrapper"
                  key={item.href}
                >
                  <Link
                    href={item.href}
                    className={[
                      "erp-sidebar__item",
                      active
                        ? "erp-sidebar__item--active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={
                      !expanded
                        ? item.label
                        : undefined
                    }
                    aria-current={
                      active ? "page" : undefined
                    }
                    onClick={
                      handleMobileNavigation
                    }
                  >
                    <span className="erp-sidebar__item-icon">
                      <Icon
                        size={18}
                        strokeWidth={1.9}
                      />
                    </span>

                    <span className="erp-sidebar__item-label">
                      {item.label}
                    </span>

                    {hasChildren && (
                      <span className="erp-sidebar__item-arrow">
                        {active ? (
                          <ChevronDown
                            size={15}
                            strokeWidth={1.8}
                          />
                        ) : (
                          <ChevronRight
                            size={15}
                            strokeWidth={1.8}
                          />
                        )}
                      </span>
                    )}
                  </Link>

                  {hasChildren && active && (
                    <div className="erp-sidebar__children">
                      {item.children.map(
                        (child) => {
                          const childActive =
                            isRouteActive(
                              pathname,
                              child.href
                            );

                          return (
                            <Link
                              href={child.href}
                              key={child.href}
                              className={[
                                "erp-sidebar__child",
                                childActive
                                  ? "erp-sidebar__child--active"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-current={
                                childActive
                                  ? "page"
                                  : undefined
                              }
                              onClick={
                                handleMobileNavigation
                              }
                            >
                              <span>
                                {child.label}
                              </span>
                            </Link>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="erp-sidebar__footer">
        <div className="erp-sidebar__footer-row">
          <button
            type="button"
            className="erp-sidebar__pin"
            onClick={() =>
              setPinned(!pinned)
            }
            title={
              expanded
                ? "Collapse sidebar"
                : "Expand sidebar"
            }
            aria-label={
              expanded
                ? "Collapse sidebar"
                : "Expand sidebar"
            }
          >
            {pinned ? (
              <Lock
                size={17}
                strokeWidth={1.8}
              />
            ) : expanded ? (
              <PanelLeftClose
                size={17}
                strokeWidth={1.8}
              />
            ) : (
              <PanelLeftOpen
                size={17}
                strokeWidth={1.8}
              />
            )}
          </button>

          <div className="erp-sidebar__system">
            <span className="erp-sidebar__system-dot" />

            <span className="erp-sidebar__system-text">
              System Online
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}