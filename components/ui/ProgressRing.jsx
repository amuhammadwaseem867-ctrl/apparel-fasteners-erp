"use client";

import "./ProgressRing.css";

export default function ProgressRing({
  value = 0,
  max = 100,
  size = "medium",
  strokeWidth,
  variant = "primary",
  showValue = true,
  label,
  valueLabel,
  children,
  className = "",
}) {
  const safeMax = max > 0 ? max : 100;

  const percentage = Math.min(
    100,
    Math.max(0, (Number(value) / safeMax) * 100)
  );

  const sizes = {
    small: 52,
    medium: 72,
    large: 96,
    xlarge: 128,
  };

  const dimension = sizes[size] || sizes.medium;

  const defaultStroke = {
    small: 5,
    medium: 6,
    large: 7,
    xlarge: 8,
  };

  const stroke =
    strokeWidth || defaultStroke[size] || 6;

  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const offset =
    circumference -
    (percentage / 100) * circumference;

  const displayValue =
    valueLabel ?? `${Math.round(percentage)}%`;

  return (
    <div
      className={[
        "progress-ring",
        `progress-ring--${size}`,
        `progress-ring--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="progress-ring__visual"
        style={{
          width: dimension,
          height: dimension,
        }}
      >
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
          className="progress-ring__svg"
          role="progressbar"
          aria-valuenow={Number(value)}
          aria-valuemin={0}
          aria-valuemax={safeMax}
          aria-label={label || "Progress"}
        >
          <circle
            className="progress-ring__track"
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            strokeWidth={stroke}
          />

          <circle
            className="progress-ring__fill"
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        <div className="progress-ring__center">
          {children || (
            <>
              {showValue && (
                <span className="progress-ring__value">
                  {displayValue}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {label && (
        <span className="progress-ring__label">
          {label}
        </span>
      )}
    </div>
  );
}

export function ProductionRing({
  completed = 0,
  total = 0,
  label = "Production",
  className = "",
}) {
  return (
    <ProgressRing
      value={completed}
      max={total || 100}
      label={label}
      variant="primary"
      className={className}
    />
  );
}

export function InventoryUtilizationRing({
  used = 0,
  capacity = 0,
  className = "",
}) {
  return (
    <ProgressRing
      value={used}
      max={capacity || 100}
      label="Inventory Utilization"
      variant="info"
      className={className}
    />
  );
}