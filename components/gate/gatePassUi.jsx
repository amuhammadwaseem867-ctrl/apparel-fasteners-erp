"use client";

/* Shared labels for the gate pass pages. */

export const PASS_TYPES = {
  OUTWARD_RETURNABLE: "Outward · returnable",
  OUTWARD_NON_RETURNABLE: "Outward · non-returnable",
  INWARD: "Inward",
};

const TONES = { DRAFT: "warning", APPROVED: "warning", OUT: "warning", COMPLETED: "good", CANCELLED: "danger" };
const LABELS = { DRAFT: "Draft", APPROVED: "Approved", OUT: "Out (awaiting return)", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export function GatePassStatusBadge({ status, overdue }) {
  return <span className={`inv-badge inv-badge--${overdue ? "danger" : TONES[status]}`}>{overdue ? "Return overdue" : LABELS[status]}</span>;
}
