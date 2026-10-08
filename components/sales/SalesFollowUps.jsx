"use client";

import {
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock3,
  UserRound,
} from "lucide-react";

import "./SalesFollowUps.css";

export default function SalesFollowUps({
  followUps = [],
  title = "Follow-ups",
  description = "Customer and sales actions requiring attention.",
  href,
  className = "",
}) {
  const hasFollowUps = followUps.length > 0;

  return (
    <section className={`sales-follow-ups ${className}`}>
      <div className="sales-follow-ups__header">
        <div className="sales-follow-ups__heading">
          <h2 className="sales-follow-ups__title">
            {title}
          </h2>

          <p className="sales-follow-ups__description">
            {description}
          </p>
        </div>

        {href ? (
          <a
            href={href}
            className="sales-follow-ups__view-all"
          >
            <span>View all</span>

            <ArrowUpRight
              size={14}
              strokeWidth={1.8}
            />
          </a>
        ) : null}
      </div>

      {hasFollowUps ? (
        <div className="sales-follow-ups__list">
          {followUps.map((followUp, index) => {
            const priority =
              followUp.priority || "normal";

            return (
              <div
                className="sales-follow-ups__item"
                key={
                  followUp.id ||
                  `${followUp.title || "follow-up"}-${index}`
                }
              >
                <div
                  className={[
                    "sales-follow-ups__priority",
                    `sales-follow-ups__priority--${priority}`,
                  ].join(" ")}
                  title={`${priority} priority`}
                  aria-label={`${priority} priority`}
                >
                  {priority === "urgent" ||
                  priority === "high" ? (
                    <CircleAlert
                      size={16}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Clock3
                      size={16}
                      strokeWidth={1.8}
                    />
                  )}
                </div>

                <div className="sales-follow-ups__content">
                  <div className="sales-follow-ups__main">
                    <strong className="sales-follow-ups__title-text">
                      {followUp.title}
                    </strong>

                    {followUp.reference ? (
                      <span className="sales-follow-ups__reference">
                        {followUp.reference}
                      </span>
                    ) : null}
                  </div>

                  {followUp.customer ? (
                    <div className="sales-follow-ups__customer">
                      <UserRound
                        size={13}
                        strokeWidth={1.8}
                      />

                      <span>
                        {followUp.customer}
                      </span>
                    </div>
                  ) : null}

                  <div className="sales-follow-ups__meta">
                    {followUp.dueDate ? (
                      <span
                        className={[
                          "sales-follow-ups__meta-item",
                          followUp.overdue
                            ? "sales-follow-ups__meta-item--overdue"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <CalendarClock
                          size={13}
                          strokeWidth={1.8}
                        />

                        {followUp.dueDate}
                      </span>
                    ) : null}

                    {followUp.assignee ? (
                      <span className="sales-follow-ups__meta-item">
                        <UserRound
                          size={13}
                          strokeWidth={1.8}
                        />

                        {followUp.assignee}
                      </span>
                    ) : null}
                  </div>
                </div>

                {followUp.href ? (
                  <a
                    href={followUp.href}
                    className="sales-follow-ups__action"
                    aria-label={`Open ${followUp.title}`}
                  >
                    <ChevronRight
                      size={16}
                      strokeWidth={1.8}
                    />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sales-follow-ups__empty">
          <div className="sales-follow-ups__empty-icon">
            <CalendarClock
              size={18}
              strokeWidth={1.7}
            />
          </div>

          <div className="sales-follow-ups__empty-content">
            <strong>No follow-ups pending</strong>

            <span>
              Customer follow-ups and scheduled sales actions
              will appear here when data is available.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}