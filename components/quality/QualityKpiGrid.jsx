"use client";

import {
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import Card from "@/components/ui/Card";

import "./QualityKpiGrid.css";

export default function QualityKpiGrid({ data = {} }) {
  const items = [
    {
      label: "Open Inspections",
      value: data.openInspections ?? "—",
      description: "Inspections awaiting completion",
      icon: ClipboardCheck,
    },
    {
      label: "Pending Review",
      value: data.pendingReview ?? "—",
      description: "Results awaiting review",
      icon: ShieldCheck,
    },
    {
      label: "Open NCR",
      value: data.openNcr ?? "—",
      description: "Non-conformance cases",
      icon: AlertTriangle,
    },
    {
      label: "Rejected",
      value: data.rejected ?? "—",
      description: "Rejected inspection lots",
      icon: XCircle,
    },
  ];

  return (
    <div className="quality-kpi-grid">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Card
            key={item.label}
            className="quality-kpi-card"
            padding="md"
          >
            <div className="quality-kpi-card__top">
              <div className="quality-kpi-card__icon">
                <Icon size={18} strokeWidth={1.8} />
              </div>
            </div>

            <div className="quality-kpi-card__value">
              {item.value}
            </div>

            <div className="quality-kpi-card__label">
              {item.label}
            </div>

            <div className="quality-kpi-card__description">
              {item.description}
            </div>
          </Card>
        );
      })}
    </div>
  );
}