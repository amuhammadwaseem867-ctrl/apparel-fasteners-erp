"use client";

import {
  ClipboardPlus,
  Warehouse,
  ArrowLeftRight,
  ClipboardCheck,
  SlidersHorizontal,
  ShoppingCart,
  Check,
} from "lucide-react";

import "./InventoryWorkflow.css";

const DEFAULT_STEPS = [
  {
    key: "receive",
    number: "01",
    label: "Receive",
    description: "Record incoming stock",
    icon: ClipboardPlus,
  },
  {
    key: "store",
    number: "02",
    label: "Store",
    description: "Assign warehouse location",
    icon: Warehouse,
  },
  {
    key: "move",
    number: "03",
    label: "Move",
    description: "Transfer between locations",
    icon: ArrowLeftRight,
  },
  {
    key: "count",
    number: "04",
    label: "Count",
    description: "Verify physical stock",
    icon: ClipboardCheck,
  },
  {
    key: "adjust",
    number: "05",
    label: "Adjust",
    description: "Correct stock variance",
    icon: SlidersHorizontal,
  },
  {
    key: "reorder",
    number: "06",
    label: "Reorder",
    description: "Replenish low stock",
    icon: ShoppingCart,
  },
];

export default function InventoryWorkflow({
  steps = DEFAULT_STEPS,
  activeStep,
  completedSteps = [],
  onStepClick,
}) {
  return (
    <section className="inventory-workflow">
      <div className="inventory-workflow__header">
        <div>
          <span className="inventory-workflow__eyebrow">
            Operations
          </span>

          <h2 className="inventory-workflow__title">
            Inventory Workflow
          </h2>

          <p className="inventory-workflow__description">
            Follow the complete operational flow from receiving stock
            through replenishment.
          </p>
        </div>
      </div>

      <div className="inventory-workflow__body">
        <div className="inventory-workflow__track">
          {steps.map((step, index) => {
            const Icon = step.icon;

            const isCompleted = completedSteps.includes(step.key);
            const isActive = activeStep === step.key;

            const isClickable = Boolean(onStepClick);

            return (
              <div
                key={step.key}
                className={[
                  "inventory-workflow__step-wrapper",
                  index < steps.length - 1
                    ? "inventory-workflow__step-wrapper--connected"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className={[
                    "inventory-workflow__step",
                    isActive
                      ? "inventory-workflow__step--active"
                      : "",
                    isCompleted
                      ? "inventory-workflow__step--completed"
                      : "",
                    isClickable
                      ? "inventory-workflow__step--clickable"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onStepClick?.(step.key, step)}
                  disabled={!isClickable}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="inventory-workflow__step-icon">
                    {isCompleted ? (
                      <Check size={17} strokeWidth={2} />
                    ) : (
                      <Icon size={17} strokeWidth={1.8} />
                    )}
                  </span>

                  <span className="inventory-workflow__step-number">
                    {step.number}
                  </span>

                  <span className="inventory-workflow__step-content">
                    <strong>{step.label}</strong>
                    <span>{step.description}</span>
                  </span>
                </button>

                {index < steps.length - 1 && (
                  <span
                    className={[
                      "inventory-workflow__connector",
                      isCompleted
                        ? "inventory-workflow__connector--completed"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}