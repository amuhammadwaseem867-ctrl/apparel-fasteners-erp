"use client";

import Link from "next/link";
import {
  ClipboardList,
  ArrowUpRight,
  CalendarDays,
  Package,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import "./PlanningDemandSummary.css";

export default function PlanningDemandSummary({
  demands = [],
  href = "/planning/material-requirements",
}) {
  const hasData = Array.isArray(demands) && demands.length > 0;

  return (
    <section className="planning-demand-summary">
      <div className="planning-demand-summary__header">
        <div className="planning-demand-summary__heading">
          <div className="planning-demand-summary__icon">
            <ClipboardList
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="planning-demand-summary__title">
              Material Demand
            </h2>

            <p className="planning-demand-summary__description">
              Current demand requiring material planning.
            </p>
          </div>
        </div>

        <Link
          href={href}
          className="planning-demand-summary__link"
        >
          View requirements
          <ArrowUpRight
            size={15}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </Link>
      </div>

      {hasData ? (
        <div className="planning-demand-summary__table-wrap">
          <table className="planning-demand-summary__table">
            <thead>
              <tr>
                <th>Demand</th>
                <th>Required Date</th>
                <th>Items</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {demands.map((demand) => (
                <tr key={demand.id}>
                  <td>
                    <div className="planning-demand-summary__demand">
                      <span className="planning-demand-summary__demand-code">
                        {demand.reference || "—"}
                      </span>

                      <span className="planning-demand-summary__demand-name">
                        {demand.name || "Unnamed demand"}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className="planning-demand-summary__date">
                      <CalendarDays
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {demand.requiredDate || "—"}
                    </span>
                  </td>

                  <td>
                    <span className="planning-demand-summary__items">
                      <Package
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {demand.itemCount ?? "—"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`planning-demand-summary__status planning-demand-summary__status--${
                        demand.statusTone || "neutral"
                      }`}
                    >
                      {demand.status || "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No material demand"
          description="Sales demand and planning requirements will appear here once data is available."
          size="small"
        />
      )}
    </section>
  );
}