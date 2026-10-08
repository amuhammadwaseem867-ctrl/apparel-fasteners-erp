"use client";

import "./SalesKpiGrid.css";

import SalesOverviewCard from "./SalesOverviewCard";

export default function SalesKpiGrid({
  items = [],
  columns = 4,
  className = "",
}) {
  const gridStyle = {
    "--sales-kpi-columns": Math.min(Math.max(columns, 1), 6),
  };

  return (
    <section
      className={`sales-kpi-grid ${className}`}
      style={gridStyle}
      aria-label="Sales performance overview"
    >
      {items.length > 0 ? (
        items.map((item) => (
          <SalesOverviewCard
            key={item.id || item.label}
            label={item.label}
            value={item.value ?? 0}
            description={item.description}
            icon={item.icon}
            href={item.href}
            trend={item.trend}
            trendType={item.trendType}
          />
        ))
      ) : (
        <div className="sales-kpi-grid__empty">
          <span>No sales metrics available.</span>
        </div>
      )}
    </section>
  );
}