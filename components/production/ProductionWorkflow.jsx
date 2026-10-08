"use client";

import {
  ClipboardCheck,
  PackageMinus,
  Factory,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import "./ProductionWorkflow.css";

const DEFAULT_STEPS = [
  {
    key: "tape-dyeing",
    label: "Tape Dyeing",
    description: "Colour preparation and dyeing",
    icon: ClipboardCheck,
  },
  {
    key: "tape-press",
    label: "Tape Press",
    description: "Pressing and shaping",
    icon: PackageMinus,
  },
  {
    key: "teeth-making",
    label: "Teeth Making",
    description: "Teeth forming and finishing",
    icon: Factory,
  },
  {
    key: "plating",
    label: "Plating",
    description: "Metal coating and finish",
    icon: ShieldCheck,
  },
  {
    key: "lacquer-wax",
    label: "Lacquer & Wax",
    description: "Protective lacquer and wax",
    icon: CheckCircle2,
  },
  {
    key: "assembling",
    label: "Assembling",
    description: "Final fit and assembly",
    icon: Factory,
  },
  {
    key: "quality-check",
    label: "Quality Check",
    description: "Inspection before packing",
    icon: ShieldCheck,
  },
  {
    key: "packing",
    label: "Packing",
    description: "Packaging and dispatch setup",
    icon: PackageMinus,
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Finished goods shipment",
    icon: CheckCircle2,
  },
];

export default function ProductionWorkflow({
  steps = DEFAULT_STEPS,
  currentStep,
}) {
  return (
    <section className="production-workflow">
      <div className="production-workflow__header">
        <div>
          <span className="production-workflow__eyebrow">
            Production Flow
          </span>

          <h2>Production Workflow</h2>

          <p>
            Standard progression from released work order to completion.
          </p>
        </div>
      </div>

      <div className="production-workflow__track">
        {steps.map((step, index) => {
          const Icon = step.icon;

          const currentIndex = steps.findIndex(
            (item) => item.key === currentStep
          );

          const isCompleted =
            currentIndex >= 0 && index < currentIndex;

          const isCurrent =
            currentStep && step.key === currentStep;

          return (
            <div
              key={step.key}
              className={[
                "production-workflow__step",
                isCompleted
                  ? "production-workflow__step--completed"
                  : "",
                isCurrent
                  ? "production-workflow__step--current"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="production-workflow__node">
                <Icon size={17} strokeWidth={1.8} />
              </div>

              <div className="production-workflow__content">
                <strong>{step.label}</strong>
                <span>{step.description}</span>
              </div>

              {index < steps.length - 1 && (
                <div className="production-workflow__connector" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}