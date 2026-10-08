"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  ShoppingCart,
  UserPlus,
} from "lucide-react";

import "./SalesActivity.css";

const DEFAULT_ICONS = {
  enquiry: MessageSquare,
  quotation: FileText,
  order: ShoppingCart,
  customer: UserPlus,
  completed: CheckCircle2,
  pending: Clock3,
};

export default function SalesActivity({
  activities = [],
  title = "Recent Activity",
  description = "Latest sales events and customer activity.",
  href,
  className = "",
}) {
  const hasActivities = activities.length > 0;

  return (
    <section className={`sales-activity ${className}`}>
      <div className="sales-activity__header">
        <div className="sales-activity__heading">
          <h2 className="sales-activity__title">
            {title}
          </h2>

          <p className="sales-activity__description">
            {description}
          </p>
        </div>

        {href ? (
          <a
            href={href}
            className="sales-activity__view-all"
          >
            <span>View all</span>

            <ArrowUpRight
              size={14}
              strokeWidth={1.8}
            />
          </a>
        ) : null}
      </div>

      {hasActivities ? (
        <div className="sales-activity__list">
          {activities.map((activity, index) => {
            const Icon =
              activity.icon ||
              DEFAULT_ICONS[activity.type] ||
              FileText;

            return (
              <div
                className="sales-activity__item"
                key={
                  activity.id ||
                  `${activity.type || "activity"}-${index}`
                }
              >
                <div
                  className={[
                    "sales-activity__icon",
                    activity.status
                      ? `sales-activity__icon--${activity.status}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.8}
                  />
                </div>

                <div className="sales-activity__content">
                  <div className="sales-activity__main">
                    <strong className="sales-activity__label">
                      {activity.label}
                    </strong>

                    {activity.reference ? (
                      <span className="sales-activity__reference">
                        {activity.reference}
                      </span>
                    ) : null}
                  </div>

                  {activity.description ? (
                    <p className="sales-activity__item-description">
                      {activity.description}
                    </p>
                  ) : null}

                  {activity.meta ? (
                    <span className="sales-activity__meta">
                      {activity.meta}
                    </span>
                  ) : null}
                </div>

                {activity.time ? (
                  <time className="sales-activity__time">
                    {activity.time}
                  </time>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sales-activity__empty">
          <div className="sales-activity__empty-icon">
            <Clock3
              size={18}
              strokeWidth={1.7}
            />
          </div>

          <div className="sales-activity__empty-content">
            <strong>No sales activity yet</strong>

            <span>
              Customer enquiries, quotations and orders will
              appear here once sales data is available.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}