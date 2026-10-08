"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import Card from "@/components/ui/Card";

import "./ProcurementKpiGrid.css";

export default function ProcurementKpiGrid({
  items = [],
  columns = 5,
  className = "",
}) {
  return (
    <div
      className={`procurement-kpi-grid ${className}`}
      style={{ "--procurement-kpi-columns": columns }}
    >
      {items.length === 0 ? (
        <Card className="procurement-kpi-grid__empty">
          <div className="procurement-kpi-grid__empty-content">
            <strong>No procurement metrics available</strong>
            <span>
              Live procurement metrics will appear here once the backend is
              connected.
            </span>
          </div>
        </Card>
      ) : (
        items.map((item) => {
          const Icon = item.icon;

          const content = (
            <>
              <div className="procurement-kpi__header">
                <span className="procurement-kpi__label">
                  {item.label}
                </span>

                {Icon && (
                  <span className="procurement-kpi__icon">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                )}
              </div>

              <strong className="procurement-kpi__value">
                {item.value ?? 0}
              </strong>

              {item.description && (
                <span className="procurement-kpi__description">
                  {item.description}
                </span>
              )}

              {item.trend && (
                <span
                  className={`procurement-kpi__trend procurement-kpi__trend--${
                    item.trendType || "neutral"
                  }`}
                >
                  {item.trend}
                </span>
              )}

              {item.href && (
                <span className="procurement-kpi__link">
                  View details
                  <ArrowUpRight size={13} />
                </span>
              )}
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.id || item.label}
                href={item.href}
                className="procurement-kpi procurement-kpi--link"
              >
                {content}
              </Link>
            );
          }

          return (
            <Card
              key={item.id || item.label}
              className="procurement-kpi"
            >
              {content}
            </Card>
          );
        })
      )}
    </div>
  );
}