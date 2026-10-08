"use client";

import { useId } from "react";
import { Check, Minus } from "lucide-react";

import "./Checkbox.css";

export default function Checkbox({
  checked,
  defaultChecked = false,
  onChange,
  label,
  description,
  disabled = false,
  indeterminate = false,
  error,
  required = false,
  size = "medium",
  name,
  value,
  id,
  className = "",
}) {
  const generatedId = useId();
  const inputId =
    id ||
    `checkbox-${name || label || "input"}-${generatedId}`;

  function handleChange(event) {
    onChange?.(
      event.target.checked,
      event
    );
  }

  return (
    <div
      className={[
        "checkbox",
        `checkbox--${size}`,
        disabled ? "checkbox--disabled" : "",
        error ? "checkbox--error" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label
        className="checkbox__label"
        htmlFor={inputId}
      >
        <span className="checkbox__control">
          <input
            id={inputId}
            name={name}
            value={value}
            type="checkbox"
            checked={checked}
            defaultChecked={
              checked === undefined
                ? defaultChecked
                : undefined
            }
            disabled={disabled}
            required={required}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
            aria-describedby={
              description || error
                ? `${inputId}-description`
                : undefined
            }
          />

          <span
            className="checkbox__box"
            aria-hidden="true"
          >
            {indeterminate ? (
              <Minus size={14} strokeWidth={2.5} />
            ) : (
              <Check size={14} strokeWidth={2.5} />
            )}
          </span>
        </span>

        {(label || description) && (
          <span className="checkbox__content">
            {label && (
              <span className="checkbox__title">
                {label}

                {required && (
                  <span className="checkbox__required">
                    *
                  </span>
                )}
              </span>
            )}

            {description && (
              <span
                id={`${inputId}-description`}
                className="checkbox__description"
              >
                {description}
              </span>
            )}
          </span>
        )}
      </label>

      {error && (
        <div className="checkbox__error">
          {error}
        </div>
      )}
    </div>
  );
}

export function CheckboxGroup({
  label,
  description,
  options = [],
  value = [],
  onChange,
  disabled = false,
  error,
  direction = "vertical",
  size = "medium",
  className = "",
}) {
  function handleChange(optionValue, checked) {
    const nextValue = checked
      ? [...value, optionValue]
      : value.filter(
          (item) => item !== optionValue
        );

    onChange?.(nextValue);
  }

  return (
    <fieldset
      className={[
        "checkbox-group",
        `checkbox-group--${direction}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <legend className="checkbox-group__label">
          {label}
        </legend>
      )}

      {description && (
        <div className="checkbox-group__description">
          {description}
        </div>
      )}

      <div className="checkbox-group__options">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            id={option.id}
            label={option.label}
            description={option.description}
            value={option.value}
            checked={value.includes(option.value)}
            disabled={
              disabled || option.disabled
            }
            size={size}
            onChange={(checked) =>
              handleChange(
                option.value,
                checked
              )
            }
          />
        ))}
      </div>

      {error && (
        <div className="checkbox-group__error">
          {error}
        </div>
      )}
    </fieldset>
  );
}