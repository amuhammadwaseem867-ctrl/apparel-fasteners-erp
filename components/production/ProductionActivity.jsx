"use client";

import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  PackageCheck,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

import "./ProductionActivity.css";

const ACTIVITY_ICONS = {
  work_order: ClipboardList,
  output: PackageCheck,
  completed: CheckCircle2,
  issue: AlertTriangle,
  default: Activity,
};

export default function ProductionActivity({
  activities = [],
}) {
  return (
    <section className="production-activity">
      <div className="production-activity__header">
        <div>
          <span className="production-activity__eyebrow">
            Audit Trail
          </span>

          <h2>Production Activity</h2>

          <p>
            Recent production events and workflow activity.
          </p>
        </div>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="Production events will appear here as work orders and operations are processed."
          size="small"
        />
      ) : (
        <div className="production-activity__timeline">
          {activities.map((activity, index) => {
            const Icon =
              ACTIVITY_ICONS[activity.type] ||
              ACTIVITY_ICONS.default;

            const isLast =
              index === activities.length - 1;

            return (
              <div
                key={activity.id || index}
                className="production-activity__item"
              >
                <div className="production-activity__marker">
                  <span>
                    <Icon size={14} strokeWidth={1.8} />
                  </span>

                  {!isLast && (
                    <i aria-hidden="true" />
                  )}
                </div>

                <div className="production-activity__content">
                  <strong>
                    {activity.title || "Production activity"}
                  </strong>

                  <p>
                    {activity.description || "—"}
                  </p>

                  <div className="production-activity__meta">
                    <span>
                      {activity.user || "System"}
                    </span>

                    <span>
                      {activity.timestamp || "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}