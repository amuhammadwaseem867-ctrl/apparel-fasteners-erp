"use client";

/* Shared labels for the People & Payroll pages. */

export const EMPLOYMENT_TYPES = { PERMANENT: "Permanent", CONTRACT: "Contract", DAILY_WAGE: "Daily wage" };
export const PAY_BASIS = { MONTHLY: "Monthly salary", DAILY: "Daily rate" };
export const ATTENDANCE = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  PAID_LEAVE: "Paid leave",
  UNPAID_LEAVE: "Unpaid leave",
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly off",
};
export const RUN_STATUS = { DRAFT: ["Draft", "warning"], APPROVED: ["Approved", "warning"], PAID: ["Paid", "good"], CANCELLED: ["Cancelled", "danger"] };

export function RunStatusBadge({ status }) {
  const [label, tone] = RUN_STATUS[status] ?? [status, ""];
  return <span className={`inv-badge inv-badge--${tone}`}>{label}</span>;
}

export function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
