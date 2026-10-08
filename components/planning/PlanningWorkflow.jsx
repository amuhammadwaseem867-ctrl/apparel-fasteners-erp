"use client";

import Link from "next/link";
import {
  ShoppingCart,
  GitBranch,
  Calculator,
  PackageCheck,
  AlertTriangle,
  Factory,
  ArrowRight,
} from "lucide-react";

import "./PlanningWorkflow.css";

const DEFAULT_STEPS = [
  {
    key: "demand",
    label: "Sales Demand",
    description: "Orders and planned demand",
    icon: ShoppingCart,
    href: "/sales/orders",
  },
  {
    key: "bom",
    label: "BOM Explosion",
    description: "Calculate component demand",
    icon: GitBranch,
    href: "/planning/material-requirements",
  },
  {
    key: "mrp",
    label: "Net Requirements",
    description: "Calculate required quantities",
    icon: Calculator,
    href: "/planning/mrp-runs",
  },
  {
    key: "stock",
    label: "Stock Check",
    description: "Compare available inventory",
    icon: PackageCheck,
    href: "/inventory/stock",
  },
  {
    key: "shortage",
    label: "Shortage Detection",
    description: "Identify material gaps",
    icon: AlertTriangle,
    href: "/planning/shortages",
  },
  {
    key: "action",
    label: "Procurement / Production",
    description: "Resolve material requirements",
    icon: Factory,
    href: "/planning/production-plans",
  },
];

export default function PlanningWorkflow({
  steps = DEFAULT_STEPS,
  activeStep = null,
}) {
  return (
    <section className="planning-workflow">
      <div className="planning-workflow__header">
        <div>
          <span className="planning-workflow__eyebrow">
            MATERIAL PLANNING FLOW
          </span>

          <h2 className="planning-workflow__title">
            Planning Workflow
          </h2>

          <p className="planning-workflow__description">
            Follow demand through material planning and execution.
          </p>
        </div>
      </div>

      <div className="planning-workflow__track">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = activeStep === step.key;

          return (
            <div
              key={step.key}
              className={`planning-workflow__item ${
                isActive
                  ? "planning-workflow__item--active"
                  : ""
              }`}
            >
              <Link
                href={step.href}
                className="planning-workflow__step"
                aria-label={step.label}
              >
                <span className="planning-workflow__icon">
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </span>

                <span className="planning-workflow__content">
                  <span className="planning-workflow__label">
                    {step.label}
                  </span>

                  <span className="planning-workflow__description">
                    {step.description}
                  </span>
                </span>
              </Link>

              {index < steps.length - 1 && (
                <span
                  className="planning-workflow__connector"
                  aria-hidden="true"
                >
                  <ArrowRight size={15} strokeWidth={1.8} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}