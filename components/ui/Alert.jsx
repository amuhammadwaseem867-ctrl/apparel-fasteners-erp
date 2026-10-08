"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";

import "./Alert.css";

const VARIANT_CONFIG = {
  info: {
    icon: Info,
    title: "Information",
  },
  success: {
    icon: CheckCircle2,
    title: "Success",
  },
  warning: {
    icon: TriangleAlert,
    title: "Warning",
  },
  danger: {
    icon: XCircle,
    title: "Error",
  },
  neutral: {
    icon: AlertCircle,
    title: "Notice",
  },
};

export default function Alert({
  variant = "info",

  title,
  children,

  icon: CustomIcon,

  action,
  onClose,

  dismissible = false,

  compact = false,
  bordered = true,

  className = "",
}) {
  const config =
    VARIANT_CONFIG[variant] ||
    VARIANT_CONFIG.info;

  const Icon =
    CustomIcon || config.icon;

  const classes = [
    "erp-alert",
    `erp-alert--${variant}`,
    compact
      ? "erp-alert--compact"
      : "",
    bordered
      ? "erp-alert--bordered"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role={
        variant === "danger"
          ? "alert"
          : "status"
      }
    >
      <div className="erp-alert__icon">
        <Icon
          size={18}
          strokeWidth={1.9}
        />
      </div>

      <div className="erp-alert__content">
        {title && (
          <div className="erp-alert__title">
            {title}
          </div>
        )}

        {children && (
          <div className="erp-alert__message">
            {children}
          </div>
        )}

        {action && (
          <div className="erp-alert__action">
            {renderAction(action)}
          </div>
        )}
      </div>

      {dismissible && onClose && (
        <button
          type="button"
          className="erp-alert__close"
          aria-label="Dismiss alert"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

function renderAction(action) {
  if (!action) return null;

  if (
    typeof action === "string"
  ) {
    return (
      <button
        type="button"
        className="erp-alert__action-button"
      >
        {action}
      </button>
    );
  }

  const {
    label,
    onClick,
    href,
  } = action;

  if (href) {
    return (
      <a
        href={href}
        className="erp-alert__action-button"
      >
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="erp-alert__action-button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function InfoAlert(props) {
  return (
    <Alert
      {...props}
      variant="info"
    />
  );
}

export function SuccessAlert(props) {
  return (
    <Alert
      {...props}
      variant="success"
    />
  );
}

export function WarningAlert(props) {
  return (
    <Alert
      {...props}
      variant="warning"
    />
  );
}

export function DangerAlert(props) {
  return (
    <Alert
      {...props}
      variant="danger"
    />
  );
}