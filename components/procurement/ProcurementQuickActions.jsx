"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import Card from "@/components/ui/Card";

import "./ProcurementQuickActions.css";

export default function ProcurementQuickActions({
  actions = [],
  title = "Quick Actions",
  description = "Access frequently used procurement operations.",
  className = "",
}) {
  return (
    <Card
      title={title}
      description={description}
      className={`procurement-quick-actions-card ${className}`}
    >
      {actions.length === 0 ? (
        <div className="procurement-quick-actions__empty">
          <strong>No procurement actions available</strong>

          <span>
            Procurement actions will become available when the module
            configuration is connected.
          </span>
        </div>
      ) : (
        <div className="procurement-quick-actions">
          {actions.map((action) => {
            const Icon = action.icon;

            const content = (
              <>
                {Icon && (
                  <span
                    className={`procurement-quick-action__icon procurement-quick-action__icon--${
                      action.tone || "default"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                )}

                <span className="procurement-quick-action__content">
                  <strong>{action.label}</strong>

                  {action.description && (
                    <span>{action.description}</span>
                  )}
                </span>

                <ArrowRight
                  className="procurement-quick-action__arrow"
                  size={16}
                />
              </>
            );

            if (action.disabled) {
              return (
                <div
                  key={action.id || action.label}
                  className="procurement-quick-action procurement-quick-action--disabled"
                  aria-disabled="true"
                >
                  {content}
                </div>
              );
            }

            if (action.href) {
              return (
                <Link
                  key={action.id || action.label}
                  href={action.href}
                  className="procurement-quick-action"
                  target={action.external ? "_blank" : undefined}
                  rel={
                    action.external
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={action.id || action.label}
                type="button"
                className="procurement-quick-action"
                onClick={action.onClick}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}