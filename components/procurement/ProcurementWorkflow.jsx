"use client";

import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileSearch,
  FileText,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";

import Card from "@/components/ui/Card";

import "./ProcurementWorkflow.css";

const defaultSteps = [
  {
    id: "requisition",
    number: "01",
    title: "Purchase Requisition",
    description: "Identify and request required materials.",
    icon: ClipboardList,
    href: "/procurement/requisitions",
  },
  {
    id: "rfq",
    number: "02",
    title: "RFQ",
    description: "Request pricing and commercial terms.",
    icon: FileSearch,
    href: "/procurement/rfqs",
  },
  {
    id: "supplier-quote",
    number: "03",
    title: "Supplier Quote",
    description: "Review supplier offers and select terms.",
    icon: FileText,
  },
  {
    id: "purchase-order",
    number: "04",
    title: "Purchase Order",
    description: "Issue the approved purchase order.",
    icon: ShoppingCart,
    href: "/procurement/purchase-orders",
  },
  {
    id: "goods-receipt",
    number: "05",
    title: "Goods Receipt",
    description: "Receive, verify and record materials.",
    icon: PackageCheck,
    href: "/procurement/goods-receipts",
  },
];

export default function ProcurementWorkflow({
  steps = defaultSteps,
  title = "Procurement Workflow",
  description = "Standard material procurement lifecycle from requirement to receipt.",
  className = "",
}) {
  const hasSteps = Array.isArray(steps) && steps.length > 0;

  return (
    <Card
      title={title}
      description={description}
      className={`procurement-workflow-card ${className}`}
    >
      {!hasSteps ? (
        <div className="procurement-workflow__empty">
          <div className="procurement-workflow__empty-icon">
            <ClipboardList size={20} strokeWidth={1.7} />
          </div>

          <strong>No workflow steps configured</strong>

          <p>
            Procurement workflow stages will become active when the
            procurement configuration and backend are connected.
          </p>
        </div>
      ) : (
        <div className="procurement-workflow">
          {steps.map((step, index) => {
            const StepIcon = step.icon || ClipboardList;
            const isLast = index === steps.length - 1;

            const content = (
              <>
                <div className="procurement-workflow__number">
                  {step.number || String(index + 1).padStart(2, "0")}
                </div>

                <div className="procurement-workflow__icon">
                  <StepIcon size={18} strokeWidth={1.8} />
                </div>

                <div className="procurement-workflow__content">
                  <strong>{step.title}</strong>

                  {step.description && (
                    <p>{step.description}</p>
                  )}
                </div>

                {step.href && (
                  <ArrowRight
                    className="procurement-workflow__arrow"
                    size={15}
                  />
                )}
              </>
            );

            return (
              <div
                key={step.id || index}
                className="procurement-workflow__step-wrapper"
              >
                {step.href ? (
                  <Link
                    href={step.href}
                    className="procurement-workflow__step"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="procurement-workflow__step">
                    {content}
                  </div>
                )}

                {!isLast && (
                  <div
                    className="procurement-workflow__connector"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}