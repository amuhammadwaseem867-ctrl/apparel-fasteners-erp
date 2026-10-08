"use client";

import Link from "next/link";
import {
  ClipboardPlus,
  CalendarDays,
  Workflow,
  PackageCheck,
} from "lucide-react";

import "./ProductionQuickActions.css";

const ACTIONS = [
  {
    label: "Create Work Order",
    description: "Start a new production work order",
    href: "/production/work-orders",
    icon: ClipboardPlus,
  },
  {
    label: "Production Schedule",
    description: "Review and manage production schedule",
    href: "/production/schedule",
    icon: CalendarDays,
  },
  {
    label: "Operations",
    description: "Monitor production operations",
    href: "/production/operations",
    icon: Workflow,
  },
  {
    label: "Production Output",
    description: "Review recorded production output",
    href: "/production/output",
    icon: PackageCheck,
  },
];

export default function ProductionQuickActions() {
  return (
    <section className="production-quick-actions">
      <div className="production-quick-actions__header">
        <div>
          <span className="production-quick-actions__eyebrow">
            Production
          </span>

          <h2>Quick Actions</h2>

          <p>
            Access frequently used production workflows.
          </p>
        </div>
      </div>

      <div className="production-quick-actions__grid">
        {ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className="production-quick-action"
            >
              <span className="production-quick-action__icon">
                <Icon size={18} strokeWidth={1.8} />
              </span>

              <span className="production-quick-action__body">
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </span>

              <span className="production-quick-action__arrow">
                →
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}