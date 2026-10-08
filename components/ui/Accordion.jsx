"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import "./Accordion.css";

export default function Accordion({
  items = [],
  value,
  defaultValue,
  onChange,
  multiple = false,
  bordered = true,
  compact = false,
  variant = "default",
  className = "",
}) {
  const baseId = useId();

  const [internalValue, setInternalValue] = useState(
    defaultValue ?? (multiple ? [] : null)
  );

  const activeValue = value !== undefined ? value : internalValue;

  function isOpen(itemValue) {
    if (multiple) {
      return Array.isArray(activeValue) && activeValue.includes(itemValue);
    }

    return activeValue === itemValue;
  }

  function handleToggle(itemValue) {
    const currentlyOpen = isOpen(itemValue);

    let nextValue;

    if (multiple) {
      const current = Array.isArray(activeValue)
        ? activeValue
        : [];

      nextValue = currentlyOpen
        ? current.filter((item) => item !== itemValue)
        : [...current, itemValue];
    } else {
      nextValue = currentlyOpen ? null : itemValue;
    }

    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
  }

  const rootClassName = [
    "af-accordion",
    bordered && "af-accordion--bordered",
    compact && "af-accordion--compact",
    variant !== "default" && `af-accordion--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {items.map((item, index) => {
        const open = isOpen(item.value);
        const disabled = item.disabled;
        const contentId = `${baseId}-${item.value}-content`;
        const triggerId = `${baseId}-${item.value}-trigger`;

        return (
          <section
            key={item.value ?? index}
            className={[
              "af-accordion__item",
              open && "is-open",
              disabled && "is-disabled",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              id={triggerId}
              type="button"
              className="af-accordion__trigger"
              aria-expanded={open}
              aria-controls={contentId}
              disabled={disabled}
              onClick={() => handleToggle(item.value)}
            >
              <span className="af-accordion__trigger-main">
                {item.icon && (
                  <span className="af-accordion__icon">
                    <item.icon size={17} strokeWidth={1.8} />
                  </span>
                )}

                <span className="af-accordion__heading">
                  <span className="af-accordion__title">
                    {item.title}
                  </span>

                  {item.description && (
                    <span className="af-accordion__description">
                      {item.description}
                    </span>
                  )}
                </span>

                {item.badge && (
                  <span className="af-accordion__badge">
                    {item.badge}
                  </span>
                )}
              </span>

              <ChevronDown
                size={17}
                strokeWidth={1.8}
                className="af-accordion__chevron"
                aria-hidden="true"
              />
            </button>

            <div
              id={contentId}
              role="region"
              aria-labelledby={triggerId}
              className="af-accordion__content-wrapper"
              hidden={!open}
            >
              <div className="af-accordion__content">
                {typeof item.content === "function"
                  ? item.content({
                      open,
                      value: item.value,
                    })
                  : item.content}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function AccordionItem({
  title,
  description,
  icon: Icon,
  badge,
  value,
  children,
  open = false,
  disabled = false,
  onToggle,
  className = "",
}) {
  const [internalOpen, setInternalOpen] = useState(open);
  const isOpen = internalOpen;

  function handleToggle() {
    if (disabled) return;

    const next = !isOpen;

    setInternalOpen(next);
    onToggle?.(next);
  }

  return (
    <section
      className={[
        "af-accordion__item",
        isOpen && "is-open",
        disabled && "is-disabled",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="af-accordion__trigger"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={handleToggle}
      >
        <span className="af-accordion__trigger-main">
          {Icon && (
            <span className="af-accordion__icon">
              <Icon size={17} strokeWidth={1.8} />
            </span>
          )}

          <span className="af-accordion__heading">
            <span className="af-accordion__title">
              {title}
            </span>

            {description && (
              <span className="af-accordion__description">
                {description}
              </span>
            )}
          </span>

          {badge && (
            <span className="af-accordion__badge">
              {badge}
            </span>
          )}
        </span>

        <ChevronDown
          size={17}
          strokeWidth={1.8}
          className="af-accordion__chevron"
        />
      </button>

      {isOpen && (
        <div className="af-accordion__content-wrapper">
          <div className="af-accordion__content">
            {children}
          </div>
        </div>
      )}
    </section>
  );
}