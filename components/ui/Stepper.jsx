"use client";

import { Check, CircleAlert, CircleX } from "lucide-react";

import "./Stepper.css";

export default function Stepper({
  steps = [],
  currentStep = 0,
  orientation = "horizontal",
  size = "medium",
  variant = "default",
  clickable = false,
  onStepClick,
  showLabels = true,
  className = "",
}) {
  return (
    <div
      className={[
        "stepper",
        `stepper--${orientation}`,
        `stepper--${size}`,
        `stepper--${variant}`,
        clickable ? "stepper--clickable" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="list"
      aria-label="Progress steps"
    >
      {steps.map((step, index) => {
        const status = getStepStatus(
          step,
          index,
          currentStep
        );

        const isLast = index === steps.length - 1;

        return (
          <div
            className={[
              "stepper__step",
              `stepper__step--${status}`,
            ]
              .filter(Boolean)
              .join(" ")}
            key={step.id ?? step.value ?? index}
            role="listitem"
          >
            <button
              type="button"
              className="stepper__button"
              onClick={() => {
                if (
                  clickable &&
                  !step.disabled &&
                  onStepClick
                ) {
                  onStepClick(step, index);
                }
              }}
              disabled={!clickable || step.disabled}
              aria-current={
                status === "current"
                  ? "step"
                  : undefined
              }
            >
              <span className="stepper__indicator">
                {status === "completed" ? (
                  <Check
                    size={15}
                    strokeWidth={2.5}
                  />
                ) : status === "error" ? (
                  <CircleX
                    size={15}
                    strokeWidth={2.2}
                  />
                ) : status === "warning" ? (
                  <CircleAlert
                    size={15}
                    strokeWidth={2.2}
                  />
                ) : (
                  <span className="stepper__number">
                    {index + 1}
                  </span>
                )}
              </span>

              {showLabels && (
                <span className="stepper__content">
                  <span className="stepper__label">
                    {step.label}
                  </span>

                  {step.description && (
                    <span className="stepper__description">
                      {step.description}
                    </span>
                  )}
                </span>
              )}
            </button>

            {!isLast && (
              <span
                className={[
                  "stepper__connector",
                  status === "completed"
                    ? "stepper__connector--completed"
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
  );
}

function getStepStatus(
  step,
  index,
  currentStep
) {
  if (step.status) {
    return step.status;
  }

  if (step.disabled) {
    return "disabled";
  }

  if (index < currentStep) {
    return "completed";
  }

  if (index === currentStep) {
    return "current";
  }

  return "pending";
}

export function OrderWorkflowStepper({
  currentStep = 0,
  className = "",
}) {
  const steps = [
    {
      id: "quotation",
      label: "Quotation",
      description: "Customer approval",
    },
    {
      id: "sales-order",
      label: "Sales Order",
      description: "Order confirmed",
    },
    {
      id: "mrp",
      label: "MRP",
      description: "Material planning",
    },
    {
      id: "production",
      label: "Production",
      description: "Manufacturing",
    },
    {
      id: "quality",
      label: "Quality",
      description: "QC inspection",
    },
    {
      id: "dispatch",
      label: "Dispatch",
      description: "Shipment ready",
    },
    {
      id: "invoice",
      label: "Invoice",
      description: "Billing",
    },
    {
      id: "payment",
      label: "Payment",
      description: "Settlement",
    },
  ];

  return (
    <Stepper
      steps={steps}
      currentStep={currentStep}
      className={className}
    />
  );
}

export function ProductionStepper({
  currentStep = 0,
  className = "",
}) {
  const steps = [
    {
      id: "planned",
      label: "Planned",
    },
    {
      id: "materials",
      label: "Materials",
    },
    {
      id: "production",
      label: "Production",
    },
    {
      id: "qc",
      label: "QC",
    },
    {
      id: "completed",
      label: "Completed",
    },
  ];

  return (
    <Stepper
      steps={steps}
      currentStep={currentStep}
      className={className}
    />
  );
}

export function DispatchStepper({
  currentStep = 0,
  className = "",
}) {
  const steps = [
    {
      id: "ready",
      label: "Ready",
    },
    {
      id: "picking",
      label: "Picking",
    },
    {
      id: "packing",
      label: "Packing",
    },
    {
      id: "shipped",
      label: "Shipped",
    },
    {
      id: "delivered",
      label: "Delivered",
    },
  ];

  return (
    <Stepper
      steps={steps}
      currentStep={currentStep}
      className={className}
    />
  );
}