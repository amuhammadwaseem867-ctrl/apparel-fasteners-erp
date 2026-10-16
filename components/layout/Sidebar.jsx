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

/*
 * Simple navigation (D-038): the factory's own flow, in order, from the
 * order sheet to the payment, then stock, purchasing and people. Pages left
 * out of this menu still work by link (and from the Order Profile); they
 * are only hidden to keep the menu short.
 */
const NAV_GROUPS = [
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
          { label: "Items", href: "/inventory/item-master" },
          { label: "Stock", href: "/inventory/stock" },
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