"use client";

import React from "react";
import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  ...props
}) {
  const isDisabled = disabled || loading;

  const classes = [
    "erp-button",
    `erp-button--${variant}`,
    `erp-button--${size}`,
    loading ? "erp-button--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const renderIcon = () => {
    if (!Icon || loading) {
      return null;
    }

    /*
     * Supports:
     *
     * icon={Download}
     * icon={ClipboardList}
     * icon={<Download size={16} />}
     *
     * Lucide icons are usually forwardRef objects,
     * so typeof Icon === "function" is NOT enough.
     */

    if (React.isValidElement(Icon)) {
      return (
        <span
          className="erp-button__icon erp-button__icon--element"
          aria-hidden="true"
        >
          {Icon}
        </span>
      );
    }

    if (
      typeof Icon === "function" ||
      (typeof Icon === "object" && Icon !== null)
    ) {
      return (
        <span
          className="erp-button__icon"
          aria-hidden="true"
        >
          {React.createElement(Icon, {
            size: 16,
            strokeWidth: 2,
            "aria-hidden": true,
          })}
        </span>
      );
    }

    return null;
  };

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <span
          className="erp-button__spinner"
          aria-hidden="true"
        />
      ) : (
        iconPosition === "left" && renderIcon()
      )}

      <span className="erp-button__content">
        {children}
      </span>

      {!loading &&
        iconPosition === "right" &&
        renderIcon()}
    </button>
  );
}