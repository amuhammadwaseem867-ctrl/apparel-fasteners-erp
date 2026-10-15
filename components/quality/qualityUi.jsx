"use client";

const TONE = { OPEN: "warning", INVESTIGATING: "warning", IN_PROGRESS: "warning", DONE: "", CLOSED: "good", VERIFIED: "good", CANCELLED: "danger", MINOR: "", MAJOR: "warning", CRITICAL: "danger" };

export function QBadge({ value }) {
  const label = String(value ?? "").toLowerCase().replace(/_/g, " ");
  const tone = TONE[value] ?? "";
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{label.charAt(0).toUpperCase() + label.slice(1)}</span>;
}

export function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function todayIso(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
