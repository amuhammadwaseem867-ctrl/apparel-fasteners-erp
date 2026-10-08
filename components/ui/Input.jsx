"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  X,
  Search,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import "./Input.css";

export default function Input({
  label,
  description,
  error,
  success,
  required = false,

  value,
  defaultValue = "",
  onChange,

  placeholder = "",
  type = "text",

  name,
  id,

  disabled = false,
  readOnly = false,

  prefix,
  suffix,
  icon: Icon,

  search = false,
  clearable = false,

  size = "medium",
  fullWidth = true,

  className = "",
  inputClassName = "",

  ...props
}) {
  const generatedId = useId();

  const inputId =
    id || `input-${generatedId}`;

  const [internalValue, setInternalValue] =
    useState(defaultValue);

  const inputRef = useRef(null);

  const isControlled =
    value !== undefined;

  const currentValue = isControlled
    ? value
    : internalValue;

  function handleChange(event) {
    if (!isControlled) {
      setInternalValue(event.target.value);
    }

    onChange?.(event);
  }

  function handleClear() {
    if (disabled || readOnly) return;

    if (!isControlled) {
      setInternalValue("");
    }

    const event = {
      target: {
        name,
        value: "",
      },
      currentTarget: {
        name,
        value: "",
      },
    };

    onChange?.(event);

    inputRef.current?.focus();
  }

  const stateClass = error
    ? "ui-input-field--error"
    : success
      ? "ui-input-field--success"
      : "";

  const classes = [
    "ui-input",
    `ui-input--${size}`,
    fullWidth
      ? "ui-input--full"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {label && (
        <label
          htmlFor={inputId}
          className="ui-input__label"
        >
          {label}

          {required && (
            <span
              className="ui-input__required"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}

      {description && !error && (
        <div className="ui-input__description">
          {description}
        </div>
      )}

      <div
        className={`ui-input-field ${stateClass}`}
      >
        {search && (
          <span
            className="ui-input-field__icon"
            aria-hidden="true"
          >
            <Search size={16} />
          </span>
        )}

        {!search && Icon && (
          <span
            className="ui-input-field__icon"
            aria-hidden="true"
          >
            <Icon size={16} />
          </span>
        )}

        {prefix && (
          <span className="ui-input-field__prefix">
            {prefix}
          </span>
        )}

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type={type}
          value={currentValue ?? ""}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          onChange={handleChange}
          className={`ui-input-field__control ${
            inputClassName || ""
          }`}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `${inputId}-error`
              : description
                ? `${inputId}-description`
                : undefined
          }
          {...props}
        />

        {clearable &&
          currentValue &&
          !disabled &&
          !readOnly && (
            <button
              type="button"
              className="ui-input-field__clear"
              onClick={handleClear}
              aria-label={`Clear ${label || "input"}`}
            >
              <X size={14} />
            </button>
          )}

        {suffix && (
          <span className="ui-input-field__suffix">
            {suffix}
          </span>
        )}

        {error && (
          <span
            className="ui-input-field__status"
            aria-hidden="true"
          >
            <AlertCircle size={15} />
          </span>
        )}

        {success && !error && (
          <span
            className="ui-input-field__status"
            aria-hidden="true"
          >
            <CheckCircle2 size={15} />
          </span>
        )}
      </div>

      {error && (
        <div
          id={`${inputId}-error`}
          className="ui-input__message ui-input__message--error"
        >
          {error}
        </div>
      )}

      {success && !error && (
        <div className="ui-input__message ui-input__message--success">
          {success}
        </div>
      )}
    </div>
  );
}