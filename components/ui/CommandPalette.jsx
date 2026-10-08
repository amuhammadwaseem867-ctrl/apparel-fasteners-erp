"use client";

import {
  ArrowRight,
  Command,
  FilePlus2,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import "./CommandPalette.css";

const DEFAULT_ITEMS = [
  {
    id: "dashboard",
    label: "Command Center",
    description: "Open ERP dashboard",
    group: "Navigate",
    icon: LayoutDashboard,
    keywords:
      "dashboard home command center overview",
    href: "/dashboard",
  },
  {
    id: "orders",
    label: "Orders",
    description: "View and manage customer orders",
    group: "Navigate",
    icon: ShoppingCart,
    keywords:
      "sales orders order management customer",
    href: "/sales/orders",
  },
  {
    id: "stage-board",
    label: "Stage Board",
    description: "View the nine production stages",
    group: "Navigate",
    icon: Package,
    keywords:
      "production stage board manufacturing",
    href: "/production/stage-board",
  },
  {
    id: "inventory",
    label: "Item Master",
    description: "Raw material and finished goods catalog",
    group: "Navigate",
    icon: Package,
    keywords:
      "item master inventory stock sku",
    href: "/inventory/item-master",
  },
  {
    id: "customers",
    label: "Customers",
    description: "Manage customers and accounts",
    group: "Navigate",
    icon: Users,
    keywords:
      "customers clients accounts crm",
    href: "/sales/customers",
  },
  {
    id: "settings",
    label: "Settings",
    description: "System and ERP configuration",
    group: "Navigate",
    icon: Settings,
    keywords:
      "settings administration configuration",
    href: "/administration/settings",
  },
  {
    id: "new-order",
    label: "Create Sales Order",
    description:
      "Create a new customer sales order",
    group: "Create",
    icon: FilePlus2,
    keywords:
      "new create sales order customer",
    href: "/sales/orders/new",
  },
];

export default function CommandPalette({
  open = false,
  onClose,

  items = DEFAULT_ITEMS,

  onSelect,

  placeholder = "Search pages, orders, customers, actions...",

  title = "Command Center",
}) {
  const [query, setQuery] =
    useState("");

  const [activeIndex, setActiveIndex] =
    useState(0);

  /*
   * Reset the palette when it closes. This runs during render
   * (tracking the previous open state) instead of inside an effect.
   */
  const [previousOpen, setPreviousOpen] =
    useState(open);

  if (open !== previousOpen) {
    setPreviousOpen(open);

    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(
      () => {
        inputRef.current?.focus();
      },
      30
    );

    return () =>
      window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (
        event.key === "ArrowDown"
      ) {
        event.preventDefault();

        setActiveIndex((current) =>
          Math.min(
            current + 1,
            filteredItems.length - 1
          )
        );

        return;
      }

      if (
        event.key === "ArrowUp"
      ) {
        event.preventDefault();

        setActiveIndex((current) =>
          Math.max(current - 1, 0)
        );

        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();

        setActiveIndex(
          Math.max(
            filteredItems.length - 1,
            0
          )
        );

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const item =
          filteredItems[activeIndex];

        if (item) {
          handleSelect(item);
        }
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
  });

  const filteredItems = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const searchable = [
        item.label,
        item.description,
        item.group,
        item.keywords,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(
        normalizedQuery
      );
    });
  }, [items, query]);

  useEffect(() => {
    const activeElement =
      listRef.current?.querySelector(
        "[data-active='true']"
      );

    activeElement?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex]);

  function handleSelect(item) {
    onSelect?.(item);

    if (item.action) {
      onClose?.();
      return;
    }

    if (item.href) {
      window.location.href =
        item.href;
      return;
    }

    onClose?.();
  }

  if (!open) {
    return null;
  }

  const grouped = filteredItems.reduce(
    (groups, item) => {
      const group =
        item.group || "Results";

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push(item);

      return groups;
    },
    {}
  );

  let globalIndex = -1;

  return createPortal(
    <div className="erp-command-palette-root">
      <button
        type="button"
        className="erp-command-palette__overlay"
        aria-label="Close command palette"
        onClick={onClose}
      />

      <div
        className="erp-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="erp-command-palette__search">
          <Search
            size={20}
            className="erp-command-palette__search-icon"
          />

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder={placeholder}
            aria-label="Command search"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="erp-command-palette__shortcut">
            <span>ESC</span>
          </div>
        </div>

        <div
          ref={listRef}
          className="erp-command-palette__results"
        >
          {Object.keys(grouped).length ===
            0 && (
            <div className="erp-command-palette__empty">
              <div className="erp-command-palette__empty-icon">
                <Search size={20} />
              </div>

              <strong>
                No results found
              </strong>

              <span>
                Try another page, action or
                search term.
              </span>
            </div>
          )}

          {Object.entries(grouped).map(
            ([group, groupItems]) => (
              <section
                key={group}
                className="erp-command-palette__group"
              >
                <div className="erp-command-palette__group-title">
                  {group}
                </div>

                {groupItems.map((item) => {
                  globalIndex += 1;

                  const index =
                    globalIndex;

                  const Icon =
                    item.icon ||
                    Command;

                  const active =
                    index ===
                    activeIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={[
                        "erp-command-palette__item",
                        active
                          ? "erp-command-palette__item--active"
                          : "",
                        item.danger
                          ? "erp-command-palette__item--danger"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-active={active}
                      onMouseEnter={() =>
                        setActiveIndex(
                          index
                        )
                      }
                      onClick={() =>
                        handleSelect(item)
                      }
                    >
                      <span className="erp-command-palette__item-icon">
                        <Icon size={17} />
                      </span>

                      <span className="erp-command-palette__item-content">
                        <span className="erp-command-palette__item-label">
                          {item.label}
                        </span>

                        {item.description && (
                          <span className="erp-command-palette__item-description">
                            {item.description}
                          </span>
                        )}
                      </span>

                      {item.shortcut && (
                        <span className="erp-command-palette__item-shortcut">
                          {item.shortcut}
                        </span>
                      )}

                      {active && (
                        <ArrowRight
                          size={15}
                          className="erp-command-palette__item-arrow"
                        />
                      )}
                    </button>
                  );
                })}
              </section>
            )
          )}
        </div>

        <footer className="erp-command-palette__footer">
          <div>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>
              Navigate
            </span>
          </div>

          <div>
            <kbd>Enter</kbd>
            <span>
              Open
            </span>
          </div>

          <div>
            <kbd>Esc</kbd>
            <span>
              Close
            </span>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}