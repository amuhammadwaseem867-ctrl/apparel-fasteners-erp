"use client";

import "./Skeleton.css";

export default function Skeleton({
  width,
  height,
  variant = "text",
  radius,
  className = "",
  style = {},
}) {
  const classes = [
    "erp-skeleton",
    `erp-skeleton--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      aria-hidden="true"
      style={{
        width,
        height,
        ...(radius
          ? {
              borderRadius: radius,
            }
          : {}),
        ...style,
      }}
    />
  );
}

export function SkeletonText({
  lines = 3,
  width = "100%",
  lastLineWidth = "70%",
  className = "",
}) {
  return (
    <div
      className={[
        "erp-skeleton-text",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map(
        (_, index) => (
          <Skeleton
            key={index}
            variant="text"
            width={
              index === lines - 1
                ? lastLineWidth
                : width
            }
          />
        )
      )}
    </div>
  );
}

export function SkeletonAvatar({
  size = 40,
  className = "",
}) {
  return (
    <Skeleton
      variant="circle"
      width={size}
      height={size}
      className={className}
    />
  );
}

export function SkeletonButton({
  width = 96,
  height = 36,
  className = "",
}) {
  return (
    <Skeleton
      variant="button"
      width={width}
      height={height}
      className={className}
    />
  );
}

export function SkeletonCard({
  className = "",
}) {
  return (
    <div
      className={[
        "erp-skeleton-card",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="erp-skeleton-card__header">
        <Skeleton
          variant="text"
          width="42%"
          height={13}
        />

        <Skeleton
          variant="circle"
          width={30}
          height={30}
        />
      </div>

      <Skeleton
        variant="text"
        width="55%"
        height={27}
      />

      <Skeleton
        variant="text"
        width="72%"
        height={12}
      />
    </div>
  );
}

export function SkeletonTable({
  rows = 6,
  columns = 5,
  className = "",
}) {
  return (
    <div
      className={[
        "erp-skeleton-table",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="erp-skeleton-table__row erp-skeleton-table__row--header">
        {Array.from({ length: columns }).map(
          (_, index) => (
            <Skeleton
              key={index}
              variant="text"
              width={
                index === 0
                  ? "70%"
                  : "55%"
              }
              height={12}
            />
          )
        )}
      </div>

      {Array.from({ length: rows }).map(
        (_, rowIndex) => (
          <div
            className="erp-skeleton-table__row"
            key={rowIndex}
          >
            {Array.from({
              length: columns,
            }).map((_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                variant="text"
                width={
                  columnIndex === 0
                    ? "78%"
                    : columnIndex ===
                        columns - 1
                      ? "48%"
                      : "62%"
                }
                height={12}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}