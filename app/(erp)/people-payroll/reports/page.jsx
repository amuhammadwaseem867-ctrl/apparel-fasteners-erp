"use client";

import ReportView from "@/components/reports/ReportView";

export default function PayrollReportsPage() {
  return <ReportView report="payroll" eyebrow="People & Payroll" backHref="/people-payroll" />;
}
