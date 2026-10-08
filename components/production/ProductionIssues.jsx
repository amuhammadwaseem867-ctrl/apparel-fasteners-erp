"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

import "./ProductionIssues.css";

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    className: "critical",
  },
  high: {
    label: "High",
    className: "high",
  },
  medium: {
    label: "Medium",
    className: "medium",
  },
  low: {
    label: "Low",
    className: "low",
  },
};

export default function ProductionIssues({
  issues = [],
  href = "/production",
}) {
  return (
    <section className="production-issues">
      <div className="production-issues__header">
        <div>
          <span className="production-issues__eyebrow">
            Exceptions
          </span>

          <h2>Production Issues</h2>

          <p>
            Open issues requiring production attention.
          </p>
        </div>

        <Link
          href={href}
          className="production-issues__view-all"
        >
          View issues
          <ArrowRight size={15} />
        </Link>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No production issues"
          description="Production exceptions and unresolved issues will appear here."
          size="small"
        />
      ) : (
        <div className="production-issues__list">
          {issues.map((issue) => {
            const priority =
              PRIORITY_CONFIG[issue.priority] || {
                label: issue.priority || "—",
                className: "low",
              };

            return (
              <div
                key={issue.id || issue.code}
                className="production-issue"
              >
                <div className="production-issue__indicator" />

                <div className="production-issue__content">
                  <strong>
                    {issue.title || issue.code || "—"}
                  </strong>

                  <span>
                    {issue.description || "—"}
                  </span>

                  <small>
                    {issue.workOrder || "—"}
                  </small>
                </div>

                <span
                  className={`production-issue__priority production-issue__priority--${priority.className}`}
                >
                  {priority.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}