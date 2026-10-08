"use client";

import React from "react";
import "./EmptyState.css";

export default function EmptyState({
  icon: Icon,
  title = "No data available",
  description,
  action,
  size = "default",
  className = "",
}) {
  const classes = [
    "erp-empty-state",
    `erp-empty-state--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const renderIcon = () => {
    if (!Icon) {
      return null;
    }

    /*
     * CASE 1
     * Already-rendered React element:
     *
     * icon={<SlidersHorizontal />}
     *
     * Render it directly.
     */
    if (React.isValidElement(Icon)) {
      return React.cloneElement(Icon, {
        "aria-hidden": true,
      });
    }

    /*
     * CASE 2
     * Lucide component:
     *
     * icon={SlidersHorizontal}
     *
     * Lucide icons use forwardRef, so they are
     * objects rather than normal functions.
     *
     * React.createElement handles them correctly.
     */
    if (
      typeof Icon === "function" ||
      (typeof Icon === "object" && Icon !== null)
    ) {
      return React.createElement(Icon, {
        size: size === "small" ? 20 : 26,
        strokeWidth: 1.8,
        "aria-hidden": true,
      });
    }

    return null;
  };

  return (
    <div className={classes}>
      {Icon && (
        <div className="erp-empty-state__icon">
          {renderIcon()}
        </div>
      )}

      <div className="erp-empty-state__content">
        {title && (
          <h3 className="erp-empty-state__title">
            {title}
          </h3>
        )}

        {description && (
          <p className="erp-empty-state__description">
            {description}
          </p>
        )}

        {action && (
          <div className="erp-empty-state__action">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}