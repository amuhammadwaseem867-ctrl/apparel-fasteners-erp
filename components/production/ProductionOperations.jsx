"use client";

import Link from "next/link";
import {
  Cog,
  ArrowRight,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

import "./ProductionOperations.css";

const STATUS_CONFIG = {
  queued: {
    label: "Queued",
    className: "queued",
  },
  ready: {
    label: "Ready",
    className: "ready",
  },
  running: {
    label: "Running",
    className: "running",
  },
  paused: {
    label: "Paused",
    className: "paused",
  },
  completed: {
    label: "Completed",
    className: "completed",
  },
};

export default function ProductionOperations({
  operations = [],
  href = "/production/operations",
}) {
  return (
    <section className="production-operations">
      <div className="production-operations__header">
        <div>
          <span className="production-operations__eyebrow">
            Shop Floor
          </span>

          <h2>Operations Monitor</h2>

          <p>
            Track production operations and current execution status.
          </p>
        </div>

        <Link
          href={href}
          className="production-operations__view-all"
        >
          View operations
          <ArrowRight size={15} />
        </Link>
      </div>

      {operations.length === 0 ? (
        <EmptyState
          icon={Cog}
          title="No operations"
          description="Production operations will appear here after work orders are released."
          size="small"
        />
      ) : (
        <div className="production-operations__list">
          {operations.map((operation) => {
            const status =
              STATUS_CONFIG[operation.status] || {
                label: operation.status || "—",
                className: "queued",
              };

            const progress = Math.max(
              0,
              Math.min(100, Number(operation.progress) || 0)
            );

            return (
              <div
                key={operation.id || operation.code}
                className="production-operation"
              >
                <div className="production-operation__main">
                  <div className="production-operation__icon">
                    <Cog size={17} />
                  </div>

                  <div className="production-operation__content">
                    <strong>
                      {operation.name || operation.code || "—"}
                    </strong>

                    <span>
                      {operation.workOrder || "—"}
                    </span>

                    <small>
                      {operation.workCenter || "—"}
                    </small>
                  </div>
                </div>

                <div className="production-operation__progress">
                  <div className="production-operation__progress-top">
                    <span>Progress</span>
                    <strong>{progress}%</strong>
                  </div>

                  <div className="production-operation__bar">
                    <span
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>

                <span
                  className={`production-operation__status production-operation__status--${status.className}`}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}