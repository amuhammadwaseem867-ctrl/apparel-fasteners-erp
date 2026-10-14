"use client";

/* Small shared pieces for the production pages. */

export const ORDER_STATUS_LABELS = {
  PLANNED: "Planned",
  RELEASED: "Released",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ORDER_TONES = { RELEASED: "warning", IN_PROGRESS: "warning", ON_HOLD: "danger", COMPLETED: "good", CANCELLED: "danger" };
const STAGE_TONES = { IN_PROGRESS: "warning", COMPLETED: "good" };

export function OrderStatusBadge({ status }) {
  const tone = ORDER_TONES[status];
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{ORDER_STATUS_LABELS[status] ?? status}</span>;
}

export function StageStatusBadge({ status }) {
  const tone = STAGE_TONES[status];
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{status === "IN_PROGRESS" ? "In progress" : status === "COMPLETED" ? "Completed" : "Pending"}</span>;
}

export function PriorityBadge({ priority }) {
  if (priority === "NORMAL") return <span className="inv-badge">Normal</span>;
  const tone = priority === "URGENT" ? "danger" : priority === "HIGH" ? "warning" : "";
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>;
}

export function ProgressBar({ value, label }) {
  return (
    <div className="prd-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Stages completed"}>
      <span style={{ width: `${value}%` }} />
      <small>{value}%</small>
    </div>
  );
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
