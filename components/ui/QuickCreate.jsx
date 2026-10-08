"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Plus,
  ShoppingCart,
  Users,
  FileText,
  Package,
  ClipboardList,
  Truck,
  Factory,
  ShieldCheck,
  Receipt,
  Wallet,
  CreditCard,
  ArrowDownToLine,
  Command,
  ChevronRight,
} from "lucide-react";

import "./QuickCreate.css";

const DEFAULT_ITEMS = [
  {
    id: "sales-order",
    label: "Sales Order",
    description: "Create a new customer sales order",
    group: "Business",
    icon: ShoppingCart,
    shortcut: "SO",
    href: "/sales/orders/new",
  },
  {
    id: "customer",
    label: "Customer",
    description: "Add a new customer account",
    group: "Business",
    icon: Users,
    shortcut: "CU",
    href: "/sales/customers",
  },
  {
    id: "quotation",
    label: "Quotation",
    description: "Prepare a customer quotation",
    group: "Business",
    icon: FileText,
    shortcut: "QT",
    href: "/sales/orders",
  },
  {
    id: "product",
    label: "Product",
    description: "Create a garment, fabric or accessory",
    group: "Business",
    icon: Package,
    shortcut: "PR",
    href: "/products/new",
  },
  {
    id: "purchase-requisition",
    label: "Purchase Requisition",
    description: "Request materials or products",
    group: "Procurement",
    icon: ClipboardList,
    shortcut: "PR",
    href: "/procurement/requisitions",
  },
  {
    id: "purchase-order",
    label: "Purchase Order",
    description: "Create a supplier purchase order",
    group: "Procurement",
    icon: ShoppingCart,
    shortcut: "PO",
    href: "/procurement/purchase-orders",
  },
  {
    id: "goods-receipt",
    label: "Goods Receipt",
    description: "Receive purchased materials",
    group: "Procurement",
    icon: ArrowDownToLine,
    shortcut: "GR",
    href: "/procurement/goods-receipts",
  },
  {
    id: "production-order",
    label: "Production Order",
    description: "Start a new manufacturing order",
    group: "Operations",
    icon: Factory,
    shortcut: "MO",
    href: "/production/orders/new",
  },
  {
    id: "work-order",
    label: "Work Order",
    description: "Create an operation-level work order",
    group: "Operations",
    icon: ClipboardList,
    shortcut: "WO",
    href: "/production/work-orders",
  },
  {
    id: "qc-inspection",
    label: "QC Inspection",
    description: "Create a quality inspection",
    group: "Operations",
    icon: ShieldCheck,
    shortcut: "QC",
    href: "/quality/inspections",
  },
  {
    id: "shipment",
    label: "Shipment / Dispatch",
    description: "Prepare goods for dispatch",
    group: "Operations",
    icon: Truck,
    shortcut: "SH",
    href: "/dispatch/dispatch",
  },
  {
    id: "sales-invoice",
    label: "Sales Invoice",
    description: "Create a customer tax invoice",
    group: "Finance",
    icon: Receipt,
    shortcut: "SI",
    href: "/finance/invoices",
  },
  {
    id: "payment",
    label: "Payment / Receipt",
    description: "Record an incoming or outgoing payment",
    group: "Finance",
    icon: CreditCard,
    shortcut: "PM",
    href: "/finance/payments",
  },
  {
    id: "expense",
    label: "Expense",
    description: "Record a business expense",
    group: "Finance",
    icon: Wallet,
    shortcut: "EX",
    href: "/finance/expenses",
  },
];

const GROUP_ORDER = [
  "Business",
  "Procurement",
  "Operations",
  "Finance",
];

export default function QuickCreate({
  open = false,
  onClose,
  onSelect,
  items = DEFAULT_ITEMS,
  anchorRef,
  width = 420,
}) {
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const searchable = [
        item.label,
        item.description,
        item.group,
        item.shortcut,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalized);
    });
  }, [items, query]);

  const groupedItems = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: filteredItems.filter((item) => item.group === group),
    })).filter((section) => section.items.length > 0);
  }, [filteredItems]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setActiveIndex(0);

    requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();

        setActiveIndex((current) =>
          filteredItems.length
            ? (current + 1) % filteredItems.length
            : 0
        );

        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        setActiveIndex((current) =>
          filteredItems.length
            ? (current - 1 + filteredItems.length) %
              filteredItems.length
            : 0
        );

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const selected = filteredItems[activeIndex];

        if (selected) {
          handleSelect(selected);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, filteredItems, activeIndex, onClose]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = anchorRef?.current;

      if (!anchor) {
        setPosition({
          top: 76,
          right: 24,
        });

        return;
      }

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 16;

      let left = rect.right - width;
      let top = rect.bottom + 8;

      if (left < viewportPadding) {
        left = viewportPadding;
      }

      if (left + width > window.innerWidth - viewportPadding) {
        left = window.innerWidth - width - viewportPadding;
      }

      const estimatedHeight = 620;

      if (
        top + estimatedHeight >
        window.innerHeight - viewportPadding
      ) {
        top = Math.max(
          viewportPadding,
          rect.top - estimatedHeight - 8
        );
      }

      setPosition({
        top,
        left,
      });
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      const panel = panelRef.current;
      const anchor = anchorRef?.current;

      if (
        panel &&
        !panel.contains(event.target) &&
        !anchor?.contains(event.target)
      ) {
        onClose?.();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, [open, anchorRef, onClose]);

  function handleSelect(item) {
    onSelect?.(item);

    if (!onSelect && item.href) {
      window.location.href = item.href;
    }

    onClose?.();
  }

  function getFlatIndex(item) {
    return filteredItems.findIndex(
      (entry) => entry.id === item.id
    );
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className="quick-create"
      style={{
        width: `min(${width}px, calc(100vw - 32px))`,
        ...(position || {}),
      }}
      role="dialog"
      aria-label="Quick create"
    >
      <div className="quick-create__header">
        <div className="quick-create__heading">
          <div className="quick-create__icon">
            <Plus size={17} strokeWidth={2.4} />
          </div>

          <div>
            <h2>Quick Create</h2>
            <p>Start a new business transaction</p>
          </div>
        </div>

        <button
          type="button"
          className="quick-create__close"
          onClick={onClose}
          aria-label="Close quick create"
        >
          <X size={17} />
        </button>
      </div>

      <div className="quick-create__search">
        <Search size={17} />

        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          placeholder="Search what you want to create..."
          aria-label="Search create actions"
        />

        <kbd>
          <Command size={11} />
          K
        </kbd>
      </div>

      <div className="quick-create__body">
        {groupedItems.length === 0 ? (
          <div className="quick-create__empty">
            <Search size={22} />
            <strong>No actions found</strong>
            <span>
              Try a different search term.
            </span>
          </div>
        ) : (
          groupedItems.map((section) => (
            <section
              key={section.group}
              className="quick-create__section"
            >
              <div className="quick-create__section-title">
                {section.group}
              </div>

              <div className="quick-create__items">
                {section.items.map((item) => {
                  const Icon = item.icon || Plus;
                  const flatIndex = getFlatIndex(item);
                  const active = flatIndex === activeIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`quick-create__item ${
                        active
                          ? "quick-create__item--active"
                          : ""
                      }`}
                      onMouseEnter={() =>
                        setActiveIndex(flatIndex)
                      }
                      onClick={() => handleSelect(item)}
                    >
                      <span className="quick-create__item-icon">
                        <Icon size={17} strokeWidth={2} />
                      </span>

                      <span className="quick-create__item-content">
                        <span className="quick-create__item-label">
                          {item.label}
                        </span>

                        <span className="quick-create__item-description">
                          {item.description}
                        </span>
                      </span>

                      {item.shortcut && (
                        <kbd className="quick-create__shortcut">
                          {item.shortcut}
                        </kbd>
                      )}

                      <ChevronRight
                        size={15}
                        className="quick-create__item-arrow"
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <div className="quick-create__footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          Navigate
        </span>

        <span>
          <kbd>Enter</kbd>
          Select
        </span>

        <span>
          <kbd>Esc</kbd>
          Close
        </span>
      </div>
    </div>,
    document.body
  );
}