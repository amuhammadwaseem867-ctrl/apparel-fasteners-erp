"use client";

import {
  ClipboardList,
  PackageSearch,
  AlertTriangle,
  Factory,
} from "lucide-react";

import { StatCard } from "@/components/ui/Card";
import "./PlanningKpiGrid.css";

const KPI_CONFIG = [
  {
    key: "openDemand",
    label: "Open Demand",
    icon: ClipboardList,
    value: "—",
    description: "Sales demand awaiting planning",
  },
  {
    key: "materialRequirements",
    label: "Material Requirements",
    icon: PackageSearch,
    value: "—",
    description: "Calculated material requirements",
  },
  {
    key: "shortages",
    label: "Shortages",
    icon: AlertTriangle,
    value: "—",
    description: "Materials requiring action",
    trendType: "warning",
  },
  {
    key: "activePlans",
    label: "Active Plans",
    icon: Factory,
    value: "—",
    description: "Production plans in progress",
  },
];

export default function PlanningKpiGrid({ data = {} }) {
  return (
    <section
      className="planning-kpi-grid"
      aria-label="Planning summary"
    >
      {KPI_CONFIG.map((item) => {
        const value =
          data[item.key]?.value ??
          data[item.key] ??
          item.value;

        const description =
          data[item.key]?.description ??
          item.description;

        const trend =
          data[item.key]?.trend ?? null;

        const trendType =
          data[item.key]?.trendType ??
          item.trendType ??
          "neutral";

        return (
          <StatCard
            key={item.key}
            label={item.label}
            value={value}
            description={description}
            icon={item.icon}
            trend={trend}
            trendType={trendType}
          />
        );
      })}
    </section>
  );
}