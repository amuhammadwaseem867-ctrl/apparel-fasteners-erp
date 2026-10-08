"use client";

import Link from "next/link";
import {
  CalendarDays,
  ArrowRight,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

import "./ProductionSchedule.css";

export default function ProductionSchedule({
  schedule = [],
  href = "/production/schedule",
}) {
  return (
    <section className="production-schedule">
      <div className="production-schedule__header">
        <div>
          <span className="production-schedule__eyebrow">
            Planning
          </span>

          <h2>Production Schedule</h2>

          <p>
            Upcoming production activities and scheduled jobs.
          </p>
        </div>

        <Link
          href={href}
          className="production-schedule__view-all"
        >
          View schedule
          <ArrowRight size={15} />
        </Link>
      </div>

      {schedule.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No scheduled production"
          description="Scheduled production activities will appear here when plans are released."
          size="small"
        />
      ) : (
        <div className="production-schedule__list">
          {schedule.map((item) => (
            <div
              key={item.id || item.code}
              className="production-schedule__item"
            >
              <div className="production-schedule__date">
                <span>{item.day || "—"}</span>
                <strong>{item.date || "—"}</strong>
              </div>

              <div className="production-schedule__details">
                <strong>
                  {item.title || item.workOrder || "—"}
                </strong>

                <span>
                  {item.productName || "—"}
                </span>

                <small>
                  {item.workCenter || "—"}
                </small>
              </div>

              <div className="production-schedule__meta">
                <span>
                  {item.startTime || "—"}
                </span>

                <span>
                  {item.endTime || "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}