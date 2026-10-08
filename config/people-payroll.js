/**
 * Apparel Fastener ERP — People & Payroll domain configuration.
 *
 * Single source of truth for statuses, options and field labels used across
 * the People & Payroll module. Extend values only through backend support;
 * do not fabricate rows here.
 */

export const DEPARTMENTS = [
  { value: "management", label: "Management" },
  { value: "sales", label: "Sales" },
  { value: "production", label: "Production" },
  { value: "tape-dyeing", label: "Tape Dyeing" },
  { value: "tape-press", label: "Tape Press" },
  { value: "teeth-making", label: "Teeth Making" },
  { value: "plating", label: "Plating" },
  { value: "lacquer-and-wax", label: "Lacquer & Wax" },
  { value: "assembling", label: "Assembling" },
  { value: "quality-control", label: "Quality Control" },
  { value: "warehouse", label: "Warehouse" },
  { value: "packing", label: "Packing" },
  { value: "dispatch-and-logistics", label: "Dispatch & Logistics" },
  { value: "finance", label: "Finance" },
  { value: "hr", label: "HR" },
  { value: "administration", label: "Administration" },
];

export function getDepartmentLabel(value) {
  return DEPARTMENTS.find((department) => department.value === value)?.label || value || "—";
}

export const EMPLOYEE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on-leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "inactive", label: "Inactive" },
];

export const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
];

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export const SHIFT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const ATTENDANCE_STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "half-day", label: "Half Day" },
  { value: "leave", label: "Leave" },
  { value: "holiday", label: "Holiday" },
];

export const LEAVE_TYPES = [
  { value: "annual", label: "Annual" },
  { value: "sick", label: "Sick" },
  { value: "casual", label: "Casual" },
  { value: "unpaid", label: "Unpaid" },
  { value: "maternity", label: "Maternity" },
  { value: "other", label: "Other" },
];

export const LEAVE_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export const PAYROLL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "processing", label: "Processing" },
  { value: "pending-review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
];

export const SALARY_STRUCTURE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const ADVANCE_LOAN_STATUSES = [
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "partially-recovered", label: "Partially Recovered" },
  { value: "fully-recovered", label: "Fully Recovered" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export const DEDUCTION_TYPES = [
  { value: "late-attendance", label: "Late Attendance" },
  { value: "absence", label: "Absence" },
  { value: "loan-recovery", label: "Loan Recovery" },
  { value: "advance-recovery", label: "Advance Recovery" },
  { value: "tax", label: "Tax" },
  { value: "other", label: "Other" },
];

export const DEDUCTION_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "applied", label: "Applied" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Payroll workflow transitions (frontend enforcement of the declared sequence).
 */
export const PAYROLL_TRANSITIONS = {
  draft: ["processing"],
  processing: ["pending-review"],
  "pending-review": ["approved"],
  approved: ["paid"],
  paid: ["closed"],
  closed: [],
};

export function getPayrollStatusLabel(status) {
  return PAYROLL_STATUSES.find((item) => item.value === status)?.label || status || "—";
}

export function isPayrollTransitionAllowed(from, to) {
  const allowed = PAYROLL_TRANSITIONS[from] || [];
  return allowed.includes(to);
}
