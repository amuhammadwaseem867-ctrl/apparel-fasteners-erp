"use client";

import Link from "next/link";
import {
  Play,
  Plus,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";

import "./PlanningQuickActions.css";

const ACTIONS = [
  {
    key: "run-mrp",
    label: "Run MRP",
    description: "Calculate material requirements",
    icon: Play,
    href: "/planning/mrp-runs",
    variant: "primary",
  },
  {
    key: "production-plan",
    label: "Create Production Plan",
    description: "Plan upcoming production",
    icon: Plus,
    href: "/planning/production-plans",
    variant: "secondary",
  },
  {
    key: "requirements",
    label: "Review Requirements",
    description: "View calculated requirements",
    icon: ClipboardList,
    href: "/planning/material-requirements",
    variant: "secondary",
  },
  {
    key: "shortages",
    label: "Review Shortages",
    description: "Identify material shortages",
    icon: AlertTriangle,
    href: "/planning/shortages",
    variant: "secondary",
  },
];

export default function PlanningQuickActions({
  actions = ACTIONS,
}) {
  return (
    <section className="planning-quick-actions">
      <div className="planning-quick-actions__header">
        <div>
          <span className="planning-quick-actions__eyebrow">
            PLANNING TOOLS
          </span>

          <h2 className="planning-quick-actions__title">
            Quick Actions
          </h2>

          <p className="planning-quick-actions__description">
            Start common planning and material requirement workflows.
          </p>
        </div>
      </div>

      <div className="planning-quick-actions__grid">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.key}
              href={action.href}
              className={`planning-action planning-action--${action.variant}`}
            >
              <span className="planning-action__icon">
                <Icon
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>

              <span className="planning-action__content">
                <span className="planning-action__label">
                  {action.label}
                </span>

                <span className="planning-action__description">
                  {action.description}
                </span>
              </span>

              <span
                className="planning-action__arrow"
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}