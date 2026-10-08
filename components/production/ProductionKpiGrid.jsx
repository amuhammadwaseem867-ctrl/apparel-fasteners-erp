"use client";

import {
  ClipboardList,
  Factory,
  Wrench,
  AlertTriangle,
} from "lucide-react";

import { StatCard } from "@/components/ui/Card";

import "./ProductionKpiGrid.css";

const KPI_ITEMS = [
  {
    key: "openWorkOrders",
    label: "Open Work Orders",
    description: "Active production orders",
    icon: ClipboardList,
  },
  {
    key: "inProduction",
    label: "In Production",
    description: "Orders currently running",
    icon: Factory,
  },
  {
    key: "scheduledOperations",
    label: "Scheduled Operations",
    description: "Operations awaiting execution",
    icon: Wrench,
  },
  {
    key: "productionIssues",
    label: "Production Issues",
    description: "Open production exceptions",
    icon: AlertTriangle,
  },
];

export default function ProductionKpiGrid({ data = {} }) {
  return (
    <section
      className="production-kpi-grid"
      aria-label="Production performance summary"
    >
      {KPI_ITEMS.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          value={data[item.key] ?? "—"}
          description={item.description}
          icon={item.icon}
        />
      ))}
    </section>
  );
}