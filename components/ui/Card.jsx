"use client";

import "./Card.css";

export default function Card({
  children,
  title,
  description,
  action,
  headerAction,
  footer,
  className = "",
  bodyClassName = "",
  padding = true,
  bordered = true,
  hoverable = false,
  compact = false,
}) {
  const classes = [
    "ui-card",
    bordered ? "ui-card--bordered" : "",
    padding ? "ui-card--padding" : "ui-card--no-padding",
    hoverable ? "ui-card--hoverable" : "",
    compact ? "ui-card--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const hasHeader =
    title ||
    description ||
    action ||
    headerAction;

  return (
    <section className={classes}>
      {hasHeader && (
        <div className="ui-card__header">
          <div className="ui-card__heading">
            {title && (
              <h3 className="ui-card__title">
                {title}
              </h3>
            )}

            {description && (
              <p className="ui-card__description">
                {description}
              </p>
            )}
          </div>

          {(action || headerAction) && (
            <div className="ui-card__actions">
              {headerAction}
              {action}
            </div>
          )}
        </div>
      )}

      <div
        className={`ui-card__body ${
          bodyClassName || ""
        }`}
      >
        {children}
      </div>

      {footer && (
        <div className="ui-card__footer">
          {footer}
        </div>
      )}
    </section>
  );
}

/* Small reusable stat card */

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  trend,
  trendType = "neutral",
  className = "",
}) {
  return (
    <Card
      className={`ui-stat-card ${className}`}
      padding
    >
      <div className="ui-stat-card__top">
        <div className="ui-stat-card__content">
          <span className="ui-stat-card__label">
            {label}
          </span>

          <strong className="ui-stat-card__value">
            {value}
          </strong>

          {description && (
            <span className="ui-stat-card__description">
              {description}
            </span>
          )}
        </div>

        {Icon && (
          <div className="ui-stat-card__icon">
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}
      </div>

      {trend && (
        <div
          className={`ui-stat-card__trend ui-stat-card__trend--${trendType}`}
        >
          {trend}
        </div>
      )}
    </Card>
  );
}