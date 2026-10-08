"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Command,
  Menu,
  Plus,
  Search,
  Settings,
  User,
  X,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Factory,
  ClipboardCheck,
  Truck,
  Receipt,
} from "lucide-react";

import "./Topbar.css";

const PAGE_NAMES = {
  "/dashboard": {
    section: "Command Center",
    title: "Dashboard",
  },
  "/sales": {
    section: "Business",
    title: "Sales & CRM",
  },
  "/products": {
    section: "Business",
    title: "Products",
  },
  "/procurement": {
    section: "Business",
    title: "Procurement",
  },
  "/inventory": {
    section: "Materials & Inventory",
    title: "Inventory",
  },
  "/planning": {
    section: "Materials & Inventory",
    title: "Planning / MRP",
  },
  "/production": {
    section: "Factory Operations",
    title: "Production",
  },
  "/quality": {
    section: "Factory Operations",
    title: "Quality Control",
  },
  "/packing": {
    section: "Factory Operations",
    title: "Packing",
  },
  "/dispatch": {
    section: "Factory Operations",
    title: "Dispatch & Logistics",
  },
  "/finance": {
    section: "Finance & People",
    title: "Finance",
  },
  "/people-payroll": {
    section: "Finance & People",
    title: "People & Payroll",
  },
  "/reports": {
    section: "Finance & People",
    title: "Reports & Analytics",
  },
  "/administration": {
    section: "Administration",
    title: "Settings",
  },
};

const QUICK_ACTIONS = [
  {
    label: "New Sales Order",
    description: "Create a customer sales order",
    href: "/sales/orders/new",
    icon: ShoppingCart,
  },
  {
    label: "New Product",
    description: "Create a product or variant",
    href: "/products/new",
    icon: Package,
  },
  {
    label: "New Purchase Order",
    description: "Create a supplier purchase order",
    href: "/procurement/purchase-orders",
    icon: Receipt,
  },
  {
    label: "New Production Order",
    description: "Create a production order",
    href: "/production/orders/new",
    icon: Factory,
  },
  {
    label: "Quality Inspection",
    description: "Start a quality inspection",
    href: "/quality/inspections",
    icon: ClipboardCheck,
  },
  {
    label: "New Dispatch",
    description: "Create a shipment",
    href: "/dispatch/shipments",
    icon: Truck,
  },
];

function getPageContext(pathname) {
  if (PAGE_NAMES[pathname]) {
    return PAGE_NAMES[pathname];
  }

  const matchingPath = Object.keys(PAGE_NAMES)
    .filter((path) => path !== "/dashboard")
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname.startsWith(`${path}/`));

  if (matchingPath) {
    return PAGE_NAMES[matchingPath];
  }

  return {
    section: "Apparel Fastener ERP",
    title: "Workspace",
  };
}

export default function Topbar({ onMenuClick }) {
  const pathname = usePathname();

  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const pageContext = getPageContext(pathname);

  useEffect(() => {
    function handleKeyboard(event) {
      const commandKey = event.ctrlKey || event.metaKey;

      if (
        commandKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        setSearchOpen(true);
        setCreateOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setCreateOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
    };
  }, []);

  function closeMenus() {
    setSearchOpen(false);
    setCreateOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }

  function toggleMenu(menu) {
    setSearchOpen(
      menu === "search" ? !searchOpen : false
    );

    setCreateOpen(
      menu === "create" ? !createOpen : false
    );

    setNotificationsOpen(
      menu === "notifications"
        ? !notificationsOpen
        : false
    );

    setProfileOpen(
      menu === "profile" ? !profileOpen : false
    );
  }

  return (
    <>
      <header className="erp-topbar">
        <div className="erp-topbar__left">
          <button
            type="button"
            className="erp-topbar__menu"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className="erp-topbar__context">
            <span className="erp-topbar__section">
              {pageContext.section}
            </span>

            <span className="erp-topbar__separator">
              /
            </span>

            <span className="erp-topbar__title">
              {pageContext.title}
            </span>
          </div>
        </div>

        <div className="erp-topbar__right">
          {/* Search */}
          <button
            type="button"
            className="erp-topbar__search-trigger"
            onClick={() => toggleMenu("search")}
          >
            <Search size={17} />

            <span className="erp-topbar__search-text">
              Search anything
            </span>

            <span className="erp-topbar__shortcut">
              <Command size={12} />
              K
            </span>
          </button>

          {/* New */}
          <button
            type="button"
            className="erp-topbar__create"
            onClick={() => toggleMenu("create")}
          >
            <Plus size={17} />
            <span>New</span>
          </button>

          {/* Notifications */}
          <div className="erp-topbar__action-wrap">
            <button
              type="button"
              className="erp-topbar__icon-button"
              onClick={() =>
                toggleMenu("notifications")
              }
              aria-label="Notifications"
            >
              <Bell size={18} />

              <span className="erp-topbar__notification-dot">
                0
              </span>
            </button>

            {notificationsOpen && (
              <div className="erp-topbar__dropdown erp-topbar__dropdown--notifications">
                <div className="erp-topbar__dropdown-header">
                  <div>
                    <strong>Notifications</strong>
                    <span>0 unread alerts</span>
                  </div>

                  <button
                    type="button"
                    onClick={closeMenus}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="erp-topbar__notification-list">
                  <div className="erp-topbar__notification-empty">
                    No notifications yet. Notifications will appear
                    once the backend is connected.
                  </div>
                </div>

                <div className="erp-topbar__dropdown-footer">
                  <button type="button">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            type="button"
            className="erp-topbar__icon-button erp-topbar__settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>

          {/* Profile */}
          <div className="erp-topbar__action-wrap">
            <button
              type="button"
              className="erp-topbar__profile"
              onClick={() => toggleMenu("profile")}
            >
              <span className="erp-topbar__avatar">
                WA
              </span>

              <span className="erp-topbar__profile-copy">
                <strong>Waseem Akram</strong>
                <small>Administrator</small>
              </span>

              <ChevronDown size={15} />
            </button>

            {profileOpen && (
              <div className="erp-topbar__dropdown erp-topbar__dropdown--profile">
                <div className="erp-topbar__profile-header">
                  <span className="erp-topbar__avatar erp-topbar__avatar--large">
                    WA
                  </span>

                  <div>
                    <strong>Waseem Akram</strong>
                    <span>Administrator</span>
                  </div>
                </div>

                <div className="erp-topbar__profile-links">
                  <button type="button">
                    <User size={16} />
                    My Profile
                  </button>

                  <button type="button">
                    <Settings size={16} />
                    Account Settings
                  </button>
                </div>

                <div className="erp-topbar__profile-footer">
                  <button type="button">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* COMMAND PALETTE */}
      {searchOpen && (
        <div
          className="erp-command"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSearchOpen(false);
            }
          }}
        >
          <div className="erp-command__panel">
            <div className="erp-command__search">
              <Search size={19} />

              <input
                autoFocus
                type="text"
                placeholder="Search orders, customers, products, invoices..."
              />

              <button
                type="button"
                onClick={() => setSearchOpen(false)}
              >
                ESC
              </button>
            </div>

            <div className="erp-command__body">
              <div className="erp-command__heading">
                Quick access
              </div>

              <div className="erp-command__items">
                <CommandItem
                  icon={LayoutDashboard}
                  title="Command Center"
                  description="Open ERP dashboard"
                  href="/dashboard"
                />

                <CommandItem
                  icon={ShoppingCart}
                  title="Sales Orders"
                  description="View and manage sales orders"
                  href="/sales/orders"
                />
                <CommandItem
                  icon={Package}
                  title="Inventory"
                  description="Check stock and warehouse levels"
                  href="/inventory"
                />

                <CommandItem
                  icon={Factory}
                  title="Production"
                  description="Monitor manufacturing activity"
                  href="/production"
                />
              </div>
            </div>

            <div className="erp-command__footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                Navigate
              </span>

              <span>
                <kbd>Enter</kbd>
                Open
              </span>

              <span>
                <kbd>Esc</kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MENU */}
      {createOpen && (
        <div className="erp-topbar__create-menu">
          <div className="erp-topbar__create-header">
            <div>
              <strong>Create new</strong>
              <span>Choose an action</span>
            </div>

            <button
              type="button"
              onClick={closeMenus}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="erp-topbar__create-list">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <a
                  href={action.href}
                  key={action.href}
                  className="erp-topbar__create-item"
                  onClick={closeMenus}
                >
                  <span className="erp-topbar__create-icon">
                    <Icon size={17} />
                  </span>

                  <span>
                    <strong>{action.label}</strong>
                    <small>{action.description}</small>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function Notification({
  title,
  description,
  type,
}) {
  return (
    <div className="erp-topbar__notification">
      <span
        className={`erp-topbar__notification-indicator erp-topbar__notification-indicator--${type}`}
      />

      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}

function CommandItem({
  icon: Icon,
  title,
  description,
  href,
}) {
  return (
    <a
      href={href}
      className="erp-command__item"
    >
      <span className="erp-command__item-icon">
        <Icon size={18} />
      </span>

      <span className="erp-command__item-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>

      <ChevronDown
        size={15}
        className="erp-command__item-arrow"
      />
    </a>
  );
}