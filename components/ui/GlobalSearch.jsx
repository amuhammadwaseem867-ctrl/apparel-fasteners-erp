"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  ArrowRight,
  Command,
  ShoppingCart,
  Users,
  Package,
  Warehouse,
  Receipt,
  UserRound,
  Truck,
  FileText,
  Clock3,
} from "lucide-react";

import "./GlobalSearch.css";

/*
 * Global search results are provided by the caller (typically
 * the backend once connected). Default is an empty result set —
 * no mock business data.
 *
 * Result shape:
 * { id, type, title, description, meta, icon, href }
 */
const DEFAULT_RESULTS = [];

const RECENT_SEARCHES = [];

const TYPE_ORDER = [
  "Sales Order",
  "Customer",
  "Product",
  "Inventory",
  "Invoice",
  "Employee",
  "Shipment",
];

export default function GlobalSearch({
  open = false,
  onClose,
  onSelect,
  results = DEFAULT_RESULTS,
}) {
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredResults = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return [];
    }

    return results.filter((result) => {
      const searchable = [
        result.title,
        result.description,
        result.meta,
        result.type,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(value);
    });
  }, [query, results]);

  const groupedResults = useMemo(() => {
    const groups = [];

    TYPE_ORDER.forEach((type) => {
      const matches = filteredResults.filter(
        (result) => result.type === type
      );

      if (matches.length) {
        groups.push({
          type,
          results: matches,
        });
      }
    });

    return groups;
  }, [filteredResults]);

  const flatResults = useMemo(
    () => groupedResults.flatMap((group) => group.results),
    [groupedResults]
  );

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setActiveIndex(0);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyboard(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();

        if (!flatResults.length) return;

        setActiveIndex(
          (current) => (current + 1) % flatResults.length
        );

        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        if (!flatResults.length) return;

        setActiveIndex(
          (current) =>
            (current - 1 + flatResults.length) %
            flatResults.length
        );

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const result = flatResults[activeIndex];

        if (result) {
          handleSelect(result);
        }
      }
    }

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
    };
  }, [
    open,
    flatResults,
    activeIndex,
    onClose,
  ]);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        onClose?.();
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );
    };
  }, [open, onClose]);

  function handleSelect(result) {
    onSelect?.(result);

    if (!onSelect && result.href) {
      window.location.href = result.href;
    }

    onClose?.();
  }

  function handleRecentSearch(value) {
    setQuery(value);
    setActiveIndex(0);
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="global-search">
      <div
        ref={panelRef}
        className="global-search__panel"
        role="dialog"
        aria-label="Global search"
      >
        <div className="global-search__header">
          <div className="global-search__search">
            <Search size={19} />

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search orders, customers, products, invoices..."
              aria-label="Search ERP"
              autoComplete="off"
            />

            {query && (
              <button
                type="button"
                className="global-search__clear"
                onClick={() => {
                  setQuery("");
                  setActiveIndex(0);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}

            <kbd>
              <Command size={11} />
              K
            </kbd>
          </div>

          <button
            type="button"
            className="global-search__close"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>

        <div className="global-search__body">
          {!query.trim() ? (
            <div className="global-search__recent">
              <div className="global-search__section-label">
                <Clock3 size={14} />
                Recent searches
              </div>

              <div className="global-search__recent-list">
                {RECENT_SEARCHES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="global-search__recent-item"
                    onClick={() =>
                      handleRecentSearch(item)
                    }
                  >
                    <Clock3 size={15} />
                    <span>{item}</span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>

              <div className="global-search__hint">
                Search across sales, products, inventory,
                production, finance and people.
              </div>
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="global-search__empty">
              <div className="global-search__empty-icon">
                <Search size={22} />
              </div>

              <strong>No results found</strong>

              <span>
                No records match “{query}”.
              </span>

              <button
                type="button"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="global-search__results">
              {groupedResults.map((group) => (
                <section
                  key={group.type}
                  className="global-search__group"
                >
                  <div className="global-search__section-label">
                    {group.type}
                  </div>

                  <div className="global-search__result-list">
                    {group.results.map((result) => {
                      const Icon = result.icon || Package;
                      const index =
                        flatResults.findIndex(
                          (item) =>
                            item.id === result.id
                        );

                      const active =
                        index === activeIndex;

                      return (
                        <button
                          key={result.id}
                          type="button"
                          className={`global-search__result ${
                            active
                              ? "global-search__result--active"
                              : ""
                          }`}
                          onMouseEnter={() =>
                            setActiveIndex(index)
                          }
                          onClick={() =>
                            handleSelect(result)
                          }
                        >
                          <span className="global-search__result-icon">
                            <Icon
                              size={17}
                              strokeWidth={2}
                            />
                          </span>

                          <span className="global-search__result-content">
                            <span className="global-search__result-title">
                              {highlightMatch(
                                result.title,
                                query
                              )}
                            </span>

                            <span className="global-search__result-description">
                              {result.description}
                            </span>
                          </span>

                          <span className="global-search__result-meta">
                            {result.meta}
                          </span>

                          <ArrowRight
                            size={15}
                            className="global-search__result-arrow"
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="global-search__footer">
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
    </div>,
    document.body
  );
}

function highlightMatch(text, query) {
  const value = query.trim();

  if (!value) {
    return text;
  }

  const index = text
    .toLowerCase()
    .indexOf(value.toLowerCase());

  if (index === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, index)}

      <mark>
        {text.slice(index, index + value.length)}
      </mark>

      {text.slice(index + value.length)}
    </>
  );
}