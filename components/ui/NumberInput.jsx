"use client";

import { useEffect, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";

import "./NumberInput.css";

export default function NumberInput({
  value,
  defaultValue = "",
  onChange,

  label,
  description,
  error,
  success,
  required = false,

  min,
  max,
  step = 1,

  placeholder = "0",
  prefix,
  suffix,

  disabled = false,
  readOnly = false,

  size = "medium",
  fullWidth = false,
  compact = false,

  allowDecimals = true,
  precision,

  showControls = true,

  name,
  id,
  className = "",
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const isControlled = value !== undefined;

  const [internalValue, setInternalValue] = useState(
    defaultValue === null || defaultValue === undefined
      ? ""
      : String(defaultValue)
  );

  const currentValue = isControlled
    ? value === null || value === undefined
      ? ""
      : String(value)
    : internalValue;

  function parseNumber(inputValue) {
    if (inputValue === "" || inputValue === "-") {
      return null;
    }

    const parsed = Number(inputValue);

    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatValue(number) {
    if (precision !== undefined) {
      return Number(number).toFixed(precision);
    }

    return String(number);
  }

  function clamp(number) {
    let next = number;

    if (min !== undefined && next < Number(min)) {
      next = Number(min);
    }

    if (max !== undefined && next > Number(max)) {
      next = Number(max);
    }

    return next;
  }

  function emitChange(nextValue) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue === "" ? "" : Number(nextValue));
  }

  function handleChange(event) {
    let nextValue = event.target.value;

    if (!allowDecimals) {
      nextValue = nextValue.replace(/[^\d-]/g, "");
    } else {
      nextValue = nextValue.replace(/[^\d.-]/g, "");
    }

    const parts = nextValue.split("-");

    if (parts.length > 2) {
      nextValue = `-${parts.slice(1).join("")}`;
    }

    if (allowDecimals) {
      const decimalParts = nextValue.split(".");

      if (decimalParts.length > 2) {
        nextValue =
          decimalParts[0] +
          "." +
          decimalParts.slice(1).join("");
      }

      if (
        precision !== undefined &&
        decimalParts[1]?.length > precision
      ) {
        nextValue =
          decimalParts[0] +
          "." +
          decimalParts[1].slice(0, precision);
      }
    }

    if (nextValue === "") {
      emitChange("");
      return;
    }

    const numericValue = parseNumber(nextValue);

    if (numericValue === null) {
      return;
    }

    if (
      min !== undefined &&
      numericValue < Number(min)
    ) {
      if (nextValue !== "-") {
        emitChange(nextValue);
      }
      return;
    }

    if (
      max !== undefined &&
      numericValue > Number(max)
    ) {
      return;
    }

    emitChange(nextValue);
  }

  function adjust(direction) {
    const numericValue = parseNumber(currentValue);

    let baseValue =
      numericValue === null
        ? min !== undefined
          ? Number(min)
          : 0
        : numericValue;

    const nextValue = clamp(
      baseValue + Number(step) * direction
    );

    const formatted = formatValue(nextValue);

    emitChange(formatted);
  }

  function handleKeyDown(event) {
    if (disabled || readOnly) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      adjust(1);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      adjust(-1);
    }

    if (event.key === "Enter") {
      const numericValue = parseNumber(currentValue);

      if (numericValue !== null) {
        const normalized = clamp(numericValue);
        emitChange(formatValue(normalized));
      }
    }
  }

  useEffect(() => {
    if (
      precision !== undefined &&
      currentValue !== "" &&
      parseNumber(currentValue) !== null
    ) {
      // Formatting is intentionally not forced while typing.
    }
  }, [precision, currentValue]);

  const numericValue = parseNumber(currentValue);

  const decrementDisabled =
    disabled ||
    readOnly ||
    (min !== undefined &&
      numericValue !== null &&
      numericValue <= Number(min));

  const incrementDisabled =
    disabled ||
    readOnly ||
    (max !== undefined &&
      numericValue !== null &&
      numericValue >= Number(max));

  const rootClassName = [
    "af-number-input",
    `af-number-input--${size}`,
    fullWidth && "af-number-input--full",
    compact && "af-number-input--compact",
    error && "af-number-input--error",
    success && "af-number-input--success",
    disabled && "af-number-input--disabled",
    readOnly && "af-number-input--readonly",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {label && (
        <label
          htmlFor={inputId}
          className="af-number-input__label"
        >
          {label}

          {required && (
            <span className="af-number-input__required">
              *
            </span>
          )}
        </label>
      )}

      {description && (
        <div className="af-number-input__description">
          {description}
        </div>
      )}

      <div className="af-number-input__field">
        {showControls && (
          <button
            type="button"
            className="af-number-input__control"
            onClick={() => adjust(-1)}
            disabled={decrementDisabled}
            aria-label="Decrease value"
          >
            <Minus size={15} strokeWidth={2} />
          </button>
        )}

        <div className="af-number-input__input-wrap">
          {prefix && (
            <span className="af-number-input__prefix">
              {prefix}
            </span>
          )}

          <input
            id={inputId}
            name={name}
            type="text"
            inputMode={allowDecimals ? "decimal" : "numeric"}
            value={currentValue}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${inputId}-error`
                : description
                ? `${inputId}-description`
                : undefined
            }
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />

          {suffix && (
            <span className="af-number-input__suffix">
              {suffix}
            </span>
          )}
        </div>

        {showControls && (
          <button
            type="button"
            className="af-number-input__control"
            onClick={() => adjust(1)}
            disabled={incrementDisabled}
            aria-label="Increase value"
          >
            <Plus size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {error && (
        <div
          id={`${inputId}-error`}
          className="af-number-input__message af-number-input__message--error"
        >
          {error}
        </div>
      )}

      {success && !error && (
        <div
          className="af-number-input__message af-number-input__message--success"
        >
          {success}
        </div>
      )}
    </div>
  );
}

export function QuantityInput(props) {
  return (
    <NumberInput
      step={1}
      min={0}
      suffix="pcs"
      {...props}
    />
  );
}

export function DecimalInput(props) {
  return (
    <NumberInput
      step={0.01}
      min={0}
      precision={2}
      allowDecimals
      {...props}
    />
  );
}

export function CurrencyInput({
  currency = "₨",
  ...props
}) {
  return (
    <NumberInput
      prefix={currency}
      min={0}
      step={1}
      allowDecimals
      precision={2}
      {...props}
    />
  );
}