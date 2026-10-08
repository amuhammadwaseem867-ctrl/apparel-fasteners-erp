"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import Card from "@/components/ui/Card";

import "./ProcurementPipeline.css";

const defaultStages = [
  {
    id: "requisitions",
    label: "Purchase Requisitions",
    shortLabel: "Requisitions",
    description: "Material requirements awaiting procurement.",
    value: 0,
    href: "/procurement/requisitions",
  },
  {
    id: "rfqs",
    label: "RFQs",
    shortLabel: "RFQs",
    description: "Requests sent to suppliers.",
    value: 0,
    href: "/procurement/rfqs",
  },
  {
    id: "quotes",
    label: "Supplier Quotes",
    shortLabel: "Quotes",
    description: "Supplier quotations awaiting evaluation.",
    value: 0,
    href: "/procurement/rfqs",
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    shortLabel: "POs",
    description: "Approved procurement commitments.",
    value: 0,
    href: "/procurement/purchase-orders",
  },
  {
    id: "goods-receipts",
    label: "Goods Receipts",
    shortLabel: "Receipts",
    description: "Incoming materials awaiting receipt.",
    value: 0,
    href: "/procurement/goods-receipts",
  },
];

export default function ProcurementPipeline({
  stages = defaultStages,
  title = "Procurement Pipeline",
  description = "Track the procurement lifecycle from material requirement to receipt.",
  className = "",
}) {
  const hasStages = Array.isArray(stages) && stages.length > 0;

  return (
    <Card
      title={title}
      description={description}
      className={`procurement-pipeline-card ${className}`}
    >
      {!hasStages ? (
        <div className="procurement-pipeline__empty">
          <div className="procurement-pipeline__empty-line" />

          <strong>No procurement pipeline data</strong>

          <p>
            Requisitions, RFQs, supplier quotes, purchase orders and receipts
            will appear here after backend integration.
          </p>
        </div>
      ) : (
        <div className="procurement-pipeline">
          {stages.map((stage, index) => {
            const isLast = index === stages.length - 1;
            const value = stage.value ?? 0;

            const stageContent = (
              <>
                <div className="procurement-pipeline__stage-header">
                  <span className="procurement-pipeline__stage-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="procurement-pipeline__stage-value">
                    {value}
                  </span>
                </div>

                <div className="procurement-pipeline__node">
                  <span />
                </div>

                <strong className="procurement-pipeline__stage-label">
                  {stage.shortLabel || stage.label}
                </strong>

                {stage.description && (
                  <span className="procurement-pipeline__stage-description">
                    {stage.description}
                  </span>
                )}

                {stage.href && (
                  <span className="procurement-pipeline__stage-link">
                    View
                    <ArrowRight size={13} />
                  </span>
                )}
              </>
            );

            return (
              <div
                key={stage.id || stage.label || index}
                className="procurement-pipeline__stage-wrapper"
              >
                {stage.href ? (
                  <Link
                    href={stage.href}
                    className="procurement-pipeline__stage"
                  >
                    {stageContent}
                  </Link>
                ) : (
                  <div className="procurement-pipeline__stage">
                    {stageContent}
                  </div>
                )}

                {!isLast && (
                  <div className="procurement-pipeline__connector">
                    <ArrowRight size={15} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}