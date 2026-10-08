"use client";

import { useId } from "react";
import { Check } from "lucide-react";

import "./Switch.css";

export default function Switch({
  checked,
  defaultChecked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = "medium",
  onLabel = "On",
  offLabel = "Off",
  showState = false,
  name,
  id,
  className = "",
}) {
  const generatedId = useId();
  const switchId =
    id ||
    `switch-${name || label || "input"}-${generatedId}`;

  const isControlled =
    checked !== undefined;

  function handleChange(event) {
    onChange?.(
      event.target.checked,
      event
    );
  }

  return (
    <div
      className={[
        "switch",
        `switch--${size}`,
        disabled ? "switch--disabled" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label
        className="switch__label"
        htmlFor={switchId}
      >
        <span className="switch__control">
          <input
            id={switchId}
            name={name}
            type="checkbox"
            role="switch"
            checked={
              isControlled
                ? checked
                : undefined
            }
            defaultChecked={
              !isControlled
                ? defaultChecked
                : undefined
            }
            disabled={disabled}
            onChange={handleChange}
          />

          <span className="switch__track">
            <span className="switch__thumb">
              <Check
                className="switch__check"
                size={11}
                strokeWidth={3}
              />
            </span>
          </span>
        </span>

        {(label || description) && (
          <span className="switch__content">
            {label && (
              <span className="switch__title">
                {label}
              </span>
            )}

            {description && (
              <span className="switch__description">
                {description}
              </span>
            )}
          </span>
        )}

        {showState && (
          <span className="switch__state">
            {checked ? onLabel : offLabel}
          </span>
        )}
      </label>
    </div>
  );
}