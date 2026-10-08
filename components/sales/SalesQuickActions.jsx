"use client";

import {
  ArrowUpRight,
  ChevronRight,
  Plus,
} from "lucide-react";

import "./SalesQuickActions.css";

export default function SalesQuickActions({
  actions = [],
  title = "Quick Actions",
  description = "Access common sales workflows.",
  className = "",
}) {
  const hasActions = actions.length > 0;

  return (
    <section className={`sales-quick-actions ${className}`}>
      <div className="sales-quick-actions__header">
        <div className="sales-quick-actions__heading">
          <h2 className="sales-quick-actions__title">
            {title}
          </h2>

          <p className="sales-quick-actions__description">
            {description}
          </p>
        </div>
      </div>

      {hasActions ? (
        <div className="sales-quick-actions__list">
          {actions.map((action, index) => {
            const Icon = action.icon || Plus;

            const content = (
              <>
                <div
                  className={[
                    "sales-quick-actions__icon",
                    action.tone
                      ? `sales-quick-actions__icon--${action.tone}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                  />
                </div>

                <div className="sales-quick-actions__content">
                  <strong className="sales-quick-actions__label">
                    {action.label}
                  </strong>

                  {action.description ? (
                    <span className="sales-quick-actions__item-description">
                      {action.description}
                    </span>
                  ) : null}
                </div>

                <div className="sales-quick-actions__arrow">
                  {action.external ? (
                    <ArrowUpRight
                      size={15}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <ChevronRight
                      size={16}
                      strokeWidth={1.8}
                    />
                  )}
                </div>
              </>
            );

            if (action.href && !action.disabled) {
              return (
                <a
                  href={action.href}
                  className="sales-quick-actions__item"
                  key={action.id || action.label || index}
                  target={
                    action.external
                      ? "_blank"
                      : undefined
                  }
                  rel={
                    action.external
                      ? "noreferrer"
                      : undefined
                  }
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                type="button"
                className={[
                  "sales-quick-actions__item",
                  action.disabled
                    ? "sales-quick-actions__item--disabled"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={action.id || action.label || index}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="sales-quick-actions__empty">
          <div className="sales-quick-actions__empty-icon">
            <Plus
              size={18}
              strokeWidth={1.7}
            />
          </div>

          <div className="sales-quick-actions__empty-content">
            <strong>No actions configured</strong>

            <span>
              Sales actions will become available based on
              your permissions and workflow configuration.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}