"use client";

import "./ProgressBar.css";

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  showValue = true,
  valueLabel,
  size = "medium",
  variant = "primary",
  striped = false,
  animated = false,
  showTrack = true,
  className = "",
}) {
  const safeMax = max > 0 ? max : 100;

  const percentage = Math.min(
    100,
    Math.max(0, (Number(value) / safeMax) * 100)
  );

  const displayValue =
    valueLabel ?? `${Math.round(percentage)}%`;

  return (
    <div
      className={[
        "progress-bar",
        `progress-bar--${size}`,
        `progress-bar--${variant}`,
        striped ? "progress-bar--striped" : "",
        animated ? "progress-bar--animated" : "",
        !showTrack ? "progress-bar--no-track" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {(label || showValue) && (
        <div className="progress-bar__header">
          {label && (
            <span className="progress-bar__label">
              {label}
            </span>
          )}

          {showValue && (
            <span className="progress-bar__value">
              {displayValue}
            </span>
          )}
        </div>
      )}

      <div
        className="progress-bar__track"
        role="progressbar"
        aria-valuenow={Number(value)}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label || "Progress"}
      >
        <div
          className="progress-bar__fill"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

export function ProductionProgress({
  completed = 0,
  total = 0,
  className = "",
}) {
  return (
    <ProgressBar
      value={completed}
      max={total || 100}
      label="Production"
      valueLabel={
        total
          ? `${completed.toLocaleString()} / ${total.toLocaleString()}`
          : "0%"
      }
      variant="primary"
      className={className}
    />
  );
}

export function QualityProgress({
  passed = 0,
  inspected = 0,
  className = "",
}) {
  const percentage =
    inspected > 0
      ? Math.round((passed / inspected) * 100)
      : 0;

  return (
    <ProgressBar
      value={percentage}
      label="QC Pass Rate"
      variant={
        percentage >= 95
          ? "success"
          : percentage >= 85
            ? "warning"
            : "danger"
      }
      className={className}
    />
  );
}

export function FulfillmentProgress({
  fulfilled = 0,
  ordered = 0,
  className = "",
}) {
  return (
    <ProgressBar
      value={fulfilled}
      max={ordered || 100}
      label="Order Fulfillment"
      valueLabel={
        ordered
          ? `${fulfilled.toLocaleString()} / ${ordered.toLocaleString()}`
          : "0%"
      }
      variant="success"
      className={className}
    />
  );
}