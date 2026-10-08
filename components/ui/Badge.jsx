"use client";

import {
  Check,
  CheckCircle2,
  Clock3,
  AlertCircle,
  AlertTriangle,
  CircleDot,
  XCircle,
  Truck,
  PackageCheck,
  Factory,
  Ban,
  CircleDollarSign,
  ShieldCheck,
  Info,
} from "lucide-react";

import "./Badge.css";

const ICONS = {
  success: CheckCircle2,
  approved: ShieldCheck,
  active: Check,
  pending: Clock3,
  warning: AlertTriangle,
  danger: XCircle,
  error: XCircle,
  info: Info,
  neutral: CircleDot,
  processing: Clock3,
  production: Factory,
  dispatch: Truck,
  ready: PackageCheck,
  paid: CircleDollarSign,
  cancelled: Ban,
};

export default function Badge({
  children,
  variant = "neutral",
  size = "medium",

  icon,
  iconPosition = "left",
  dot = false,

  removable = false,
  onRemove,

  title,

  className = "",
}) {
  const Icon =
    icon === false
      ? null
      : icon || ICONS[variant] || null;

  const classes = [
    "erp-badge",
    `erp-badge--${variant}`,
    `erp-badge--${size}`,
    iconPosition === "right"
      ? "erp-badge--icon-right"
      : "",
    dot
      ? "erp-badge--dot"
      : "",
    removable
      ? "erp-badge--removable"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleRemove(event) {
    event.stopPropagation();

    if (onRemove) {
      onRemove(event);
    }
  }

  return (
    <span
      className={classes}
      title={title}
    >
      {dot && (
        <span
          className="erp-badge__dot"
          aria-hidden="true"
        />
      )}

      {!dot &&
        Icon &&
        iconPosition === "left" && (
          <Icon
            className="erp-badge__icon"
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
        )}

      <span className="erp-badge__label">
        {children}
      </span>

      {!dot &&
        Icon &&
        iconPosition === "right" && (
          <Icon
            className="erp-badge__icon"
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
        )}

      {removable && (
        <button
          type="button"
          className="erp-badge__remove"
          onClick={handleRemove}
          aria-label={`Remove ${children}`}
        >
          ×
        </button>
      )}
    </span>
  );
}