"use client";

import { useId } from "react";
import "./Radio.css";

export default function Radio({
  checked,
  defaultChecked = false,
  onChange,
  label,
  description,
  disabled = false,
  required = false,
  name,
  value,
  id,
  size = "medium",
  error,
  className = "",
}) {
  const generatedId = useId();
  const inputId =
    id ||
    `radio-${name || label || "input"}-${generatedId}`;

  return (
    <div
      className={[
        "radio",
        `radio--${size}`,
        disabled ? "radio--disabled" : "",
        error ? "radio--error" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label
        className="radio__label"
        htmlFor={inputId}
      >
        <span className="radio__control">
          <input
            id={inputId}
            name={name}
            value={value}
            type="radio"
            checked={checked}
            defaultChecked={
              checked === undefined
                ? defaultChecked
                : undefined
            }
            disabled={disabled}
            required={required}
            onChange={(event) =>
              onChange?.(
                event.target.checked,
                event
              )
            }
          />

          <span
            className="radio__circle"
            aria-hidden="true"
          />
        </span>

        {(label || description) && (
          <span className="radio__content">
            {label && (
              <span className="radio__title">
                {label}

                {required && (
                  <span className="radio__required">
                    *
                  </span>
                )}
              </span>
            )}

            {description && (
              <span className="radio__description">
                {description}
              </span>
            )}
          </span>
        )}
      </label>

      {error && (
        <div className="radio__error">
          {error}
        </div>
      )}
    </div>
  );
}

export function RadioGroup({
  label,
  description,
  options = [],
  value,
  onChange,
  name,
  disabled = false,
  error,
  direction = "vertical",
  size = "medium",
  className = "",
}) {
  return (
    <fieldset
      className={[
        "radio-group",
        `radio-group--${direction}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <legend className="radio-group__label">
          {label}
        </legend>
      )}

      {description && (
        <div className="radio-group__description">
          {description}
        </div>
      )}

      <div className="radio-group__options">
        {options.map((option) => (
          <Radio
            key={option.value}
            id={option.id}
            name={name}
            value={option.value}
            label={option.label}
            description={option.description}
            checked={value === option.value}
            disabled={
              disabled || option.disabled
            }
            size={size}
            onChange={() =>
              onChange?.(option.value)
            }
          />
        ))}
      </div>

      {error && (
        <div className="radio-group__error">
          {error}
        </div>
      )}
    </fieldset>
  );
}