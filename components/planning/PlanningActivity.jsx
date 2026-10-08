"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Play,
  PackageSearch,
  AlertTriangle,
  Factory,
  LockKeyhole,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import "./PlanningActivity.css";

const ACTIVITY_ICONS = {
  mrp: Play,
  requirement: PackageSearch,
  shortage: AlertTriangle,
  production: Factory,
  reservation: LockKeyhole,
};

export default function PlanningActivity({
  activities = [],
  href = "/planning/mrp-runs",
}) {
  const hasData =
    Array.isArray(activities) &&
    activities.length > 0;

  return (
    <section className="planning-activity">
      <div className="planning-activity__header">
        <div className="planning-activity__heading">
          <div className="planning-activity__icon">
            <Activity
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="planning-activity__title">
              Recent Planning Activity
            </h2>

            <p className="planning-activity__description">
              Latest actions and events across planning workflows.
            </p>
          </div>
        </div>

        <Link
          href={href}
          className="planning-activity__link"
        >
          View activity
          <ArrowUpRight
            size={15}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </Link>
      </div>

      {hasData ? (
        <div className="planning-activity__timeline">
          {activities.map((activity, index) => {
            const Icon =
              ACTIVITY_ICONS[activity.type] || Activity;

            const isLast =
              index === activities.length - 1;

            return (
              <div
                key={activity.id}
                className="planning-activity__item"
              >
                <div className="planning-activity__marker-column">
                  <span className="planning-activity__marker">
                    <Icon
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </span>

                  {!isLast && (
                    <span
                      className="planning-activity__line"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="planning-activity__content">
                  <div className="planning-activity__top">
                    <h3 className="planning-activity__name">
                      {activity.title || "Planning activity"}
                    </h3>

                    <time className="planning-activity__time">
                      {activity.time || "—"}
                    </time>
                  </div>

                  {activity.description && (
                    <p className="planning-activity__description-text">
                      {activity.description}
                    </p>
                  )}

                  {activity.reference && (
                    <span className="planning-activity__reference">
                      {activity.reference}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="No planning activity"
          description="MRP runs, reservations, shortages and production planning events will appear here."
          size="small"
        />
      )}
    </section>
  );
}