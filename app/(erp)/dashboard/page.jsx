"use client";

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  Factory,
  PackageCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { PRODUCTION_STAGES } from "@/config/production";

import "./Dashboard.css";

/*
 * Command Center Dashboard — factory KPIs.
 *
 * All KPI values are backend-ready placeholders (0).
 * No mock business data. When the backend is connected the
 * values come from the reporting aggregates:
 *
 * Orders: active, per-stage, QC waiting, packing, delivered,
 * delayed/overdue, due soon, completion percentage.
 * Inventory: total/available/reserved stock, WIP, low stock,
 * out-of-stock, incoming material, issued to production,
 * consumption, finished goods.
 */

const ZERO = 0;

const orderStats = [
  {
    label: "Total Active Orders",
    value: ZERO,
    icon: ShoppingCart,
    note: "open customer orders",
  },
  {
    label: "In Production",
    value: ZERO,
    icon: Factory,
    note: "orders on the stage board",
  },
  {
    label: "Orders Waiting for QC",
    value: ZERO,
    icon: CheckCircle2,
    note: "final inspection queue",
  },
  {
    label: "Orders in Packing",
    value: ZERO,
    icon: PackageCheck,
    note: "packing in progress",
  },
  {
    label: "Orders Delivered",
    value: ZERO,
    icon: Truck,
    note: "lifetime delivered",
  },
];

const alertStats = [
  {
    label: "Delayed / Overdue Orders",
    value: ZERO,
    icon: AlertTriangle,
    note: "past expected completion",
    tone: "warning",
  },
  {
    label: "Orders Due Soon",
    value: ZERO,
    icon: Clock3,
    note: "due within 7 days",
    tone: "info",
  },
];

const stageCounts = PRODUCTION_STAGES.map((stage) => ({
  ...stage,
  count: ZERO,
  quantity: ZERO,
}));

const inventoryStats = [
  { label: "Total Stock", value: ZERO, note: "all warehouses" },
  { label: "Available Stock", value: ZERO, note: "current minus reserved" },
  { label: "Reserved Stock", value: ZERO, note: "against orders" },
  { label: "WIP", value: ZERO, note: "material inside production" },
  { label: "Low Stock Alerts", value: ZERO, note: "below minimum level", tone: "warning" },
  { label: "Out-of-Stock Alerts", value: ZERO, note: "zero stock items", tone: "danger" },
  { label: "Incoming Material", value: ZERO, note: "open purchase orders" },
  { label: "Issued to Production", value: ZERO, note: "period material issue" },
  { label: "Material Consumption", value: ZERO, note: "period consumption" },
  { label: "Finished Goods", value: ZERO, note: "ready for delivery" },
];

export default function DashboardPage() {
  return (
    <div className="dashboard">
      <section className="dashboard__header">
        <div>
          <span className="dashboard__kicker">Operational overview</span>

          <h2>Command Center</h2>

          <p>
            A live view of orders, production stages, inventory,
            quality, packing and dispatch.
          </p>
        </div>

        <div className="dashboard__header-actions">
          <button type="button" className="dashboard__date">
            <Clock3 size={16} />

            <span>Command Center</span>
          </button>
        </div>
      </section>

      <section className="dashboard__stats">
        {orderStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="dashboard__stat" key={stat.label}>
              <div className="dashboard__stat-top">
                <div className="dashboard__stat-icon">
                  <Icon size={18} />
                </div>
              </div>

              <div className="dashboard__stat-value">{stat.value}</div>

              <div className="dashboard__stat-label">{stat.label}</div>

              <div className="dashboard__stat-note">{stat.note}</div>
            </article>
          );
        })}
      </section>

      <section className="dashboard__stats dashboard__stats--alerts">
        {alertStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              className={`dashboard__stat dashboard__stat--${stat.tone}`}
              key={stat.label}
            >
              <div className="dashboard__stat-top">
                <div className="dashboard__stat-icon">
                  <Icon size={18} />
                </div>
              </div>

              <div className="dashboard__stat-value">{stat.value}</div>

              <div className="dashboard__stat-label">{stat.label}</div>

              <div className="dashboard__stat-note">{stat.note}</div>
            </article>
          );
        })}

        <article className="dashboard__stat">
          <div className="dashboard__stat-top">
            <div className="dashboard__stat-icon">
              <Factory size={18} />
            </div>
          </div>

          <div className="dashboard__stat-value">0%</div>

          <div className="dashboard__stat-label">
            Production Completion
          </div>

          <div className="dashboard__stat-note">
            average across active orders
          </div>
        </article>
      </section>

      {/* STAGE DISTRIBUTION */}
      <section className="dashboard__panel">
        <div className="dashboard__panel-header">
          <div>
            <span className="dashboard__panel-kicker">Manufacturing</span>

            <h3>Orders by Production Stage</h3>
          </div>
        </div>

        <div className="dashboard__stage-grid">
          {stageCounts.map((stage) => (
            <div className="dashboard__stage" key={stage.key}>
              <span className="dashboard__stage-seq">
                {String(stage.sequence).padStart(2, "0")}
              </span>

              <div className="dashboard__stage-copy">
                <strong>{stage.label}</strong>

                <span>
                  {stage.count} orders ·{" "}
                  {stage.quantity.toLocaleString()} qty
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INVENTORY VISIBILITY */}
      <section className="dashboard__panel">
        <div className="dashboard__panel-header">
          <div>
            <span className="dashboard__panel-kicker">Inventory</span>

            <h3>Inventory Visibility</h3>
          </div>
        </div>

        <div className="dashboard__inventory-grid">
          {inventoryStats.map((stat) => (
            <div
              className={`dashboard__inventory-item${stat.tone ? ` dashboard__inventory-item--${stat.tone}` : ""
                }`}
              key={stat.label}
            >
              <strong>{stat.value.toLocaleString()}</strong>

              <span>{stat.label}</span>

              <small>{stat.note}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard__health">
        <div className="dashboard__health-indicator">
          <span className="dashboard__health-dot" />

          <strong>Awaiting backend connection</strong>
        </div>

        <span>
          Dashboard KPIs will populate once the ERP database and
          reporting backend are connected.
        </span>
      </section>
    </div>
  );
}
