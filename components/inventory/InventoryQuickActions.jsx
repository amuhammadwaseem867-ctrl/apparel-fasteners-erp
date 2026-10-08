"use client";

import {
  ClipboardPlus,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  Plus,
} from "lucide-react";

import "./InventoryQuickActions.css";

const DEFAULT_ACTIONS = [
  {
    key: "receive",
    label: "Receive Stock",
    description: "Record incoming inventory",
    icon: ClipboardPlus,
    tone: "primary",
  },
  {
    key: "movement",
    label: "Stock Movement",
    description: "Move stock between locations",
    icon: ArrowLeftRight,
    tone: "neutral",
  },
  {
    key: "adjustment",
    label: "Stock Adjustment",
    description: "Correct inventory quantities",
    icon: SlidersHorizontal,
    tone: "neutral",
  },
  {
    key: "count",
    label: "Stock Count",
    description: "Start an inventory count",
    icon: ClipboardCheck,
    tone: "neutral",
  },
];

export default function InventoryQuickActions({
  onAction,
  actions = DEFAULT_ACTIONS,
  disabled = false,
}) {
  const handleAction = (action) => {
    if (disabled) return;

    onAction?.(action.key, action);
  };

  return (
    <section className="inventory-quick-actions">
      <div className="inventory-quick-actions__header">
        <div>
          <span className="inventory-quick-actions__eyebrow">
            Actions
          </span>

          <h2 className="inventory-quick-actions__title">
            Quick Actions
          </h2>

          <p className="inventory-quick-actions__description">
            Common inventory operations and stock controls.
          </p>
        </div>
      </div>

      <div className="inventory-quick-actions__list">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.key}
              type="button"
              className={`inventory-quick-action inventory-quick-action--${action.tone}`}
              onClick={() => handleAction(action)}
              disabled={disabled}
            >
              <span className="inventory-quick-action__icon">
                <Icon size={18} strokeWidth={1.8} />
              </span>

              <span className="inventory-quick-action__content">
                <span className="inventory-quick-action__label">
                  {action.label}
                </span>

                <span className="inventory-quick-action__description">
                  {action.description}
                </span>
              </span>

              <span className="inventory-quick-action__arrow">
                <Plus size={15} strokeWidth={1.8} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}