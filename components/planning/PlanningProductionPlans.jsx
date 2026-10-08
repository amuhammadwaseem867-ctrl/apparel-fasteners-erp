"use client";

import Link from "next/link";
import {
  Factory,
  ArrowUpRight,
  CalendarDays,
  Boxes,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import "./PlanningProductionPlans.css";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    className: "draft",
  },
  planned: {
    label: "Planned",
    className: "planned",
  },
  released: {
    label: "Released",
    className: "released",
  },
  in_progress: {
    label: "In Progress",
    className: "progress",
  },
  completed: {
    label: "Completed",
    className: "completed",
  },
};

export default function PlanningProductionPlans({
  plans = [],
  href = "/planning/production-plans",
}) {
  const hasData =
    Array.isArray(plans) &&
    plans.length > 0;

  return (
    <section className="planning-production-plans">
      <div className="planning-production-plans__header">
        <div className="planning-production-plans__heading">
          <div className="planning-production-plans__icon">
            <Factory
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="planning-production-plans__title">
              Production Planning
            </h2>

            <p className="planning-production-plans__description">
              Production plans generated from current requirements.
            </p>
          </div>
        </div>

        <Link
          href={href}
          className="planning-production-plans__link"
        >
          View plans
          <ArrowUpRight
            size={15}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </Link>
      </div>

      {hasData ? (
        <div className="planning-production-plans__table-wrap">
          <table className="planning-production-plans__table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Start Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {plans.map((plan) => {
                const status =
                  STATUS_CONFIG[plan.status] ||
                  STATUS_CONFIG.draft;

                return (
                  <tr key={plan.id}>
                    <td>
                      <div className="planning-production-plans__plan">
                        <span className="planning-production-plans__plan-code">
                          {plan.reference || "—"}
                        </span>

                        <span className="planning-production-plans__plan-name">
                          {plan.name || "Production plan"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="planning-production-plans__product">
                        {plan.productName || "—"}
                      </span>
                    </td>

                    <td>
                      <span className="planning-production-plans__quantity">
                        <Boxes
                          size={14}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                        {plan.quantity ?? "—"}
                      </span>
                    </td>

                    <td>
                      <span className="planning-production-plans__date">
                        <CalendarDays
                          size={14}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                        {plan.startDate || "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`planning-production-plans__status planning-production-plans__status--${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Factory}
          title="No production plans"
          description="Production plans created from material requirements will appear here."
          size="small"
        />
      )}
    </section>
  );
}