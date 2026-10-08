"use client";

import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

const ICONS = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

export default function Toast({
  id,
  type = "info",
  title,
  message,
  duration = 5000,
  onClose,
}) {
  const Icon = ICONS[type] || Info;

  return (
    <div
      className={`erp-toast erp-toast--${type}`}
      role={
        type === "error" ||
        type === "warning"
          ? "alert"
          : "status"
      }
    >
      <div className="erp-toast__icon">
        <Icon size={18} />
      </div>

      <div className="erp-toast__content">
        {title && (
          <div className="erp-toast__title">
            {title}
          </div>
        )}

        {message && (
          <div className="erp-toast__message">
            {message}
          </div>
        )}
      </div>

      <button
        type="button"
        className="erp-toast__close"
        onClick={() => onClose?.(id)}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      {duration > 0 && (
        <div
          className="erp-toast__progress"
          style={{
            animationDuration: `${duration}ms`,
          }}
        />
      )}
    </div>
  );
}