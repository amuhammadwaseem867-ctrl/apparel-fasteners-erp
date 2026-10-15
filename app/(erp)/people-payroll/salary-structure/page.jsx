import { redirect } from "next/navigation";

/* Pay rates, allowances and the fixed deduction are set per employee (Pay). See docs/ERP_DECISIONS.md D-027. */
export default function Page() {
  redirect("/people-payroll/employees");
}

export const instant = false;
