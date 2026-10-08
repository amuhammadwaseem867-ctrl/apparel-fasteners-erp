"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import Button from "./Button";
import Input from "./Input";
import Select from "./Select";

import "./FilterPanel.css";

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  return [value];
}

function hasFilterValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return (
    value !== undefined &&
    value !== null &&
    value !== ""
  );
}

export default function FilterPanel({
  open = false,
  onClose,

  filters = {},
  onApply,
  onReset,

  title = "Filters",
  description = "Refine the records shown in this view.",

  fields = [],

  applyLabel = "Apply Filters",
  resetLabel = "Reset",

  showSearch = false,
  searchValue = "",
  onSearchChange,

  loading = false,

  side = "right",
  width = 420,
}) {
  const [draftFilters, setDraftFilters] =
    useState(filters);

  /*
   * Synchronize the draft with the incoming props when the panel
   * opens or the filters change while it is open. This runs during
   * render (adjusting state derived from props) instead of inside an
   * effect.
   */
  const [previousContext, setPreviousContext] =
    useState({ open, filters });

  if (
    previousContext.open !== open ||
    previousContext.filters !== filters
  ) {
    setPreviousContext({ open, filters });

    if (open) {
      setDraftFilters(filters);
    }
  }

  const activeCount = useMemo(() => {
    return Object.entries(draftFilters).filter(
      ([, value]) =>
        hasFilterValue(value)
    ).length;
  }, [draftFilters]);

  function updateFilter(key, value) {
    setDraftFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleReset() {
    const resetValues = {};

    fields.forEach((field) => {
      resetValues[field.key] =
        field.defaultValue ??
        (field.type === "multiselect"
          ? []
          : "");
    });

    setDraftFilters(resetValues);
    onReset?.(resetValues);
  }

  function handleApply() {
    onApply?.(draftFilters);
  }

  function handleFieldKeyDown(
    event,
    field
  ) {
    if (event.key !== "Enter") return;

    if (
      field.type === "text" ||
      field.type === "number"
    ) {
      handleApply();
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="erp-filter-panel-root">
      <button
        type="button"
        className="erp-filter-panel__overlay"
        aria-label="Close filters"
        onClick={() => {
          if (!loading) {
            onClose?.();
          }
        }}
      />

      <aside
        className={`erp-filter-panel erp-filter-panel--${side}`}
        style={{
          "--filter-panel-width":
            typeof width === "number"
              ? `${width}px`
              : width,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="erp-filter-panel__header">
          <div>
            <div className="erp-filter-panel__eyebrow">
              Filter & Refine
            </div>

            <h2 className="erp-filter-panel__title">
              {title}

              {activeCount > 0 && (
                <span className="erp-filter-panel__active-count">
                  {activeCount}
                </span>
              )}
            </h2>

            <p className="erp-filter-panel__description">
              {description}
            </p>
          </div>

          <button
            type="button"
            className="erp-filter-panel__close"
            disabled={loading}
            onClick={onClose}
            aria-label="Close filters"
          >
            <X size={18} />
          </button>
        </header>

        <div className="erp-filter-panel__body">
          {showSearch && (
            <div className="erp-filter-panel__search">
              <Input
                label="Search"
                value={searchValue}
                onChange={(event) =>
                  onSearchChange?.(
                    event.target.value
                  )
                }
                placeholder="Search records..."
                icon={Search}
                clearable
                onClear={() =>
                  onSearchChange?.("")
                }
              />
            </div>
          )}

          <div className="erp-filter-panel__fields">
            {fields.map((field) => {
              const value =
                draftFilters[field.key] ??
                field.defaultValue ??
                (field.type ===
                "multiselect"
                  ? []
                  : "");

              return (
                <FilterField
                  key={field.key}
                  field={field}
                  value={value}
                  onChange={(nextValue) =>
                    updateFilter(
                      field.key,
                      nextValue
                    )
                  }
                  onKeyDown={(event) =>
                    handleFieldKeyDown(
                      event,
                      field
                    )
                  }
                />
              );
            })}
          </div>

          {!fields.length &&
            !showSearch && (
              <div className="erp-filter-panel__empty">
                <div className="erp-filter-panel__empty-icon">
                  <Search size={20} />
                </div>

                <strong>
                  No filters configured
                </strong>

                <span>
                  Add filter fields to this
                  panel to refine records.
                </span>
              </div>
            )}
        </div>

        <footer className="erp-filter-panel__footer">
          <Button
            variant="ghost"
            size="medium"
            icon={RotateCcw}
            disabled={
              loading ||
              activeCount === 0
            }
            onClick={handleReset}
          >
            {resetLabel}
          </Button>

          <Button
            variant="primary"
            size="medium"
            icon={Check}
            loading={loading}
            onClick={handleApply}
          >
            {applyLabel}

            {activeCount > 0 && (
              <span className="erp-filter-panel__button-count">
                {activeCount}
              </span>
            )}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

function FilterField({
  field,
  value,
  onChange,
  onKeyDown,
}) {
  const {
    type = "text",
    label,
    description,
    placeholder,
    options = [],
    required = false,
    disabled = false,
    min,
    max,
    step,
  } = field;

  if (type === "select") {
    return (
      <div className="erp-filter-field">
        <Select
          label={label}
          description={description}
          value={value}
          onChange={(nextValue) =>
            onChange(nextValue)
          }
          options={options}
          placeholder={
            placeholder ||
            `Select ${label?.toLowerCase() || ""}`
          }
          disabled={disabled}
          required={required}
          clearable
        />
      </div>
    );
  }

  if (type === "multiselect") {
    return (
      <div className="erp-filter-field">
        <Select
          label={label}
          description={description}
          value={normalizeValue(value)}
          onChange={(nextValue) =>
            onChange(
              normalizeValue(nextValue)
            )
          }
          options={options}
          placeholder={
            placeholder ||
            `Select ${label?.toLowerCase() || ""}`
          }
          disabled={disabled}
          required={required}
          multiple
          searchable
          clearable
        />
      </div>
    );
  }

  if (type === "date") {
    return (
      <div className="erp-filter-field">
        <Input
          type="date"
          label={label}
          description={description}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          disabled={disabled}
          required={required}
        />
      </div>
    );
  }

  if (type === "number") {
    return (
      <div className="erp-filter-field">
        <Input
          type="number"
          label={label}
          description={description}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          required={required}
          onKeyDown={onKeyDown}
        />
      </div>
    );
  }

  if (type === "daterange") {
    const startKey = `${field.key}From`;
    const endKey = `${field.key}To`;

    return (
      <div className="erp-filter-field">
        <div className="erp-filter-field__label">
          <span>
            {label}
          </span>

          {required && (
            <span aria-hidden="true">
              *
            </span>
          )}
        </div>

        {description && (
          <div className="erp-filter-field__description">
            {description}
          </div>
        )}

        <div className="erp-filter-date-range">
          <div className="erp-filter-date-range__item">
            <Input
              type="date"
              value={
                value?.from ||
                ""
              }
              onChange={(event) =>
                onChange({
                  ...(value || {}),
                  from:
                    event.target.value,
                })
              }
              icon={Calendar}
              disabled={disabled}
            />

            <span>From</span>
          </div>

          <div className="erp-filter-date-range__item">
            <Input
              type="date"
              value={
                value?.to ||
                ""
              }
              onChange={(event) =>
                onChange({
                  ...(value || {}),
                  to:
                    event.target.value,
                })
              }
              icon={Calendar}
              disabled={disabled}
            />

            <span>To</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <label className="erp-filter-checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) =>
            onChange(
              event.target.checked
            )
          }
          disabled={disabled}
        />

        <span className="erp-filter-checkbox__mark">
          <Check size={12} />
        </span>

        <span className="erp-filter-checkbox__content">
          <strong>
            {label}
          </strong>

          {description && (
            <small>
              {description}
            </small>
          )}
        </span>
      </label>
    );
  }

  return (
    <div className="erp-filter-field">
      <Input
        type={type}
        label={label}
        description={description}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}