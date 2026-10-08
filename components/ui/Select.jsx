"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Search,
  X,
} from "lucide-react";

import "./Select.css";

export default function Select({
  id,
  name,
  label,
  description,
  error,
  success,
  required = false,

  value,
  defaultValue,

  options = [],
  placeholder = "Select an option",

  onChange,

  searchable = false,
  clearable = false,

  disabled = false,
  readOnly = false,

  multiple = false,

  size = "medium",
  fullWidth = true,

  icon: Icon,

  emptyMessage = "No options found.",

  className = "",

  ...props
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const reactId = useId();

  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] =
    useState("");

  const generatedId =
    id ||
    name ||
    `erp-select-${reactId}`;

  const hasError = Boolean(error);
  const hasSuccess = Boolean(success) && !hasError;

  const normalizedValue = multiple
    ? Array.isArray(value)
      ? value
      : Array.isArray(defaultValue)
        ? defaultValue
        : []
    : value ?? defaultValue ?? "";

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
        setSearchValue("");
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => {
        searchRef.current?.focus();
      });
    }
  }, [open, searchable]);

  const filteredOptions = options.filter(
    (option) => {
      if (option.disabled) {
        return true;
      }

      if (!searchValue.trim()) {
        return true;
      }

      const query =
        searchValue.toLowerCase();

      return (
        String(option.label)
          .toLowerCase()
          .includes(query) ||
        String(option.value)
          .toLowerCase()
          .includes(query)
      );
    }
  );

  function isSelected(optionValue) {
    if (multiple) {
      return normalizedValue.includes(
        optionValue
      );
    }

    return normalizedValue === optionValue;
  }

  function getSelectedOptions() {
    return options.filter((option) =>
      isSelected(option.value)
    );
  }

  function handleSelect(option) {
    if (
      disabled ||
      readOnly ||
      option.disabled
    ) {
      return;
    }

    if (multiple) {
      const currentValues = Array.isArray(
        normalizedValue
      )
        ? normalizedValue
        : [];

      const exists =
        currentValues.includes(option.value);

      const nextValue = exists
        ? currentValues.filter(
            (item) => item !== option.value
          )
        : [
            ...currentValues,
            option.value,
          ];

      onChange?.(nextValue);

      return;
    }

    onChange?.(option.value);

    setOpen(false);
    setSearchValue("");
  }

  function handleClear(event) {
    event.stopPropagation();

    if (disabled || readOnly) {
      return;
    }

    onChange?.(multiple ? [] : "");

    setSearchValue("");
  }

  function removeMultipleValue(
    event,
    optionValue
  ) {
    event.stopPropagation();

    if (disabled || readOnly) {
      return;
    }

    const nextValue =
      normalizedValue.filter(
        (item) => item !== optionValue
      );

    onChange?.(nextValue);
  }

  const selectedOptions =
    getSelectedOptions();

  const selectedSingle =
    !multiple
      ? selectedOptions[0]
      : null;

  const hasValue = multiple
    ? normalizedValue.length > 0
    : Boolean(normalizedValue);

  const classes = [
    "erp-select",
    `erp-select--${size}`,
    fullWidth ? "erp-select--full" : "",
    hasError ? "erp-select--error" : "",
    hasSuccess ? "erp-select--success" : "",
    disabled ? "erp-select--disabled" : "",
    readOnly ? "erp-select--readonly" : "",
    open ? "erp-select--open" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={classes}
    >
      {label && (
        <label
          htmlFor={generatedId}
          className="erp-select__label"
        >
          <span>{label}</span>

          {required && (
            <span
              className="erp-select__required"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}

      {description && (
        <div className="erp-select__description">
          {description}
        </div>
      )}

      <button
        id={generatedId}
        type="button"
        className="erp-select__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled && !readOnly) {
            setOpen((current) => !current);
          }
        }}
        {...props}
      >
        {Icon && (
          <span className="erp-select__leading-icon">
            <Icon size={16} />
          </span>
        )}

        <span className="erp-select__value">
          {multiple && hasValue ? (
            <span className="erp-select__tags">
              {selectedOptions
                .slice(0, 2)
                .map((option) => (
                  <span
                    key={option.value}
                    className="erp-select__tag"
                  >
                    <span>
                      {option.label}
                    </span>

                    {!readOnly &&
                      !disabled && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="erp-select__tag-remove"
                          onClick={(event) =>
                            removeMultipleValue(
                              event,
                              option.value
                            )
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              removeMultipleValue(
                                event,
                                option.value
                              );
                            }
                          }}
                          aria-label={`Remove ${option.label}`}
                        >
                          <X size={11} />
                        </span>
                      )}
                  </span>
                ))}

              {selectedOptions.length > 2 && (
                <span className="erp-select__tag-more">
                  +{selectedOptions.length - 2}
                </span>
              )}
            </span>
          ) : selectedSingle ? (
            <span className="erp-select__selected">
              {selectedSingle.label}
            </span>
          ) : (
            <span className="erp-select__placeholder">
              {placeholder}
            </span>
          )}
        </span>

        {clearable &&
          hasValue &&
          !disabled &&
          !readOnly && (
            <span
              role="button"
              tabIndex={0}
              className="erp-select__clear"
              onClick={handleClear}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  handleClear(event);
                }
              }}
              aria-label={`Clear ${label || "selection"}`}
            >
              <X size={14} />
            </span>
          )}

        <ChevronDown
          className="erp-select__chevron"
          size={16}
        />
      </button>

      {open && (
        <div className="erp-select__menu">
          {searchable && (
            <div className="erp-select__search">
              <Search size={15} />

              <input
                ref={searchRef}
                type="text"
                value={searchValue}
                placeholder="Search..."
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                onClick={(event) =>
                  event.stopPropagation()
                }
              />
            </div>
          )}

          <div
            className="erp-select__options"
            role="listbox"
            aria-multiselectable={multiple}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map(
                (option) => {
                  const selected =
                    isSelected(
                      option.value
                    );

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`erp-select__option ${
                        selected
                          ? "erp-select__option--selected"
                          : ""
                      } ${
                        option.disabled
                          ? "erp-select__option--disabled"
                          : ""
                      }`}
                      disabled={
                        option.disabled
                      }
                      onClick={() =>
                        handleSelect(option)
                      }
                    >
                      {option.icon && (
                        <span className="erp-select__option-icon">
                          <option.icon
                            size={15}
                          />
                        </span>
                      )}

                      <span className="erp-select__option-content">
                        <span className="erp-select__option-label">
                          {option.label}
                        </span>

                        {option.description && (
                          <span className="erp-select__option-description">
                            {
                              option.description
                            }
                          </span>
                        )}
                      </span>

                      {selected && (
                        <Check
                          className="erp-select__check"
                          size={16}
                        />
                      )}
                    </button>
                  );
                }
              )
            ) : (
              <div className="erp-select__empty">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {hasError && (
        <div
          className="erp-select__message erp-select__message--error"
          role="alert"
        >
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      {!hasError && hasSuccess && (
        <div className="erp-select__message erp-select__message--success">
          <Check size={13} />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}