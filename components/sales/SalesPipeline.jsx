"use client";

import { ArrowRight, ChevronRight } from "lucide-react";

import "./SalesPipeline.css";

export default function SalesPipeline({
  stages = [],
  title = "Sales Pipeline",
  description = "Track enquiries, quotations and orders through the sales process.",
  className = "",
}) {
  const hasStages = stages.length > 0;

  return (
    <section className={`sales-pipeline ${className}`}>
      <div className="sales-pipeline__header">
        <div className="sales-pipeline__heading">
          <h2 className="sales-pipeline__title">
            {title}
          </h2>

          <p className="sales-pipeline__description">
            {description}
          </p>
        </div>
      </div>

      {hasStages ? (
        <div className="sales-pipeline__body">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isLast = index === stages.length - 1;

            return (
              <div
                className="sales-pipeline__stage-wrap"
                key={stage.id || stage.label || index}
              >
                <div
                  className={[
                    "sales-pipeline__stage",
                    stage.status
                      ? `sales-pipeline__stage--${stage.status}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="sales-pipeline__stage-top">
                    <div className="sales-pipeline__stage-icon">
                      {Icon ? (
                        <Icon
                          size={17}
                          strokeWidth={1.8}
                        />
                      ) : (
                        <span className="sales-pipeline__stage-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      )}
                    </div>

                    {stage.href ? (
                      <a
                        href={stage.href}
                        className="sales-pipeline__stage-action"
                        aria-label={`Open ${stage.label}`}
                      >
                        <ChevronRight
                          size={15}
                          strokeWidth={1.8}
                        />
                      </a>
                    ) : null}
                  </div>

                  <div className="sales-pipeline__stage-content">
                    <span className="sales-pipeline__stage-label">
                      {stage.label}
                    </span>

                    <strong className="sales-pipeline__stage-value">
                      {stage.value ?? 0}
                    </strong>

                    {stage.description ? (
                      <span className="sales-pipeline__stage-description">
                        {stage.description}
                      </span>
                    ) : null}
                  </div>
                </div>

                {!isLast ? (
                  <div
                    className="sales-pipeline__connector"
                    aria-hidden="true"
                  >
                    <ArrowRight
                      size={16}
                      strokeWidth={1.6}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sales-pipeline__empty">
          <div className="sales-pipeline__empty-icon">
            <ArrowRight
              size={18}
              strokeWidth={1.7}
            />
          </div>

          <div className="sales-pipeline__empty-content">
            <strong>No pipeline data available</strong>

            <span>
              Sales pipeline stages will appear here when sales data
              is connected.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}