"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CalendarCheck,
  ChartNoAxesCombined,
  ClipboardList,
  FileBarChart,
  ReceiptText,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { usePeoplePayrollStore } from "@/lib/usePeoplePayrollStore";
import { DEPARTMENTS, getDepartmentLabel } from "@/config/people-payroll";

import "../shared.css";
import "./reports.css";

const REPORTS = [
  { value: "payroll-summary", label: "Payroll Summary", icon: FileBarChart, source: "payrollEntries" },
  { value: "salary-cost", label: "Salary Cost", icon: Banknote, source: "payrollEntries" },
  { value: "department-payroll", label: "Department Payroll", icon: Users, source: "payrollEntries" },
  { value: "attendance-summary", label: "Attendance Summary", icon: CalendarCheck, source: "attendance" },
  { value: "overtime-report", label: "Overtime Report", icon: ChartNoAxesCombined, source: "attendance" },
  { value: "leave-report", label: "Leave Report", icon: ClipboardList, source: "leaveRequests" },
  { value: "deductions-report", label: "Deductions Report", icon: ReceiptText, source: "deductions" },
  { value: "advances-loans-report", label: "Advances & Loans Report", icon: Banknote, source: "advancesLoans" },
  { value: "payroll-history", label: "Payroll History", icon: FileBarChart, source: "payrollEntries" },
];

function formattedDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formattedAmount(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

function recordDate(record, reportType, periods) {
  if (reportType === "leave-report") return record.fromDate || "";
  if (reportType === "advances-loans-report") return record.requestDate || "";
  if (reportType === "deductions-report") return record.effectiveDate || "";
  if (record.date) return record.date;
  const period = periods.find((item) => item.id === record.payrollPeriodId);
  return period?.startDate || "";
}

function recordAmount(record, reportType) {
  if (reportType === "overtime-report") return record.overtime;
  if (reportType === "deductions-report") return record.amount;
  if (reportType === "advances-loans-report") return record.amount;
  if (reportType === "salary-cost" || reportType === "department-payroll") return record.grossSalary;
  return record.netSalary;
}

function amountHeading(reportType) {
  if (reportType === "overtime-report") return "Overtime";
  if (reportType === "deductions-report") return "Deduction Amount";
  if (reportType === "advances-loans-report") return "Amount";
  if (reportType === "salary-cost" || reportType === "department-payroll") return "Gross Salary";
  return "Net Salary";
}

export default function PayrollReportsPage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();
  const [reportType, setReportType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [payrollPeriodId, setPayrollPeriodId] = useState("");
  const [generated, setGenerated] = useState(null);

  const employeeOptions = useMemo(
    () => (store.employees || []).map((employee) => ({
      value: employee.employeeId || employee.id,
      label: `${employee.fullName} (${employee.employeeId || "No ID"})`,
    })),
    [store.employees]
  );
  const selectedReport = REPORTS.find((report) => report.value === reportType);

  const reportRecords = useMemo(() => {
    if (!selectedReport) return [];
    const sourceRecords = store[selectedReport.source] || [];
    return sourceRecords.filter((record) => {
      const date = recordDate(record, reportType, store.payrollPeriods);
      const selectedPeriod = payrollPeriodId ? store.payrollPeriods.find((period) => period.id === payrollPeriodId) : null;
      const matchesDate = (!fromDate || Boolean(date && date >= fromDate)) && (!toDate || Boolean(date && date <= toDate));
      const matchesEmployee = !employeeId || record.employeeId === employeeId;
      const matchesDepartment = !departmentId || record.departmentId === departmentId;
      const matchesPeriod = !selectedPeriod || record.payrollPeriodId === selectedPeriod.id ||
        (record.payrollPeriod === selectedPeriod.periodName);
      return matchesDate && matchesEmployee && matchesDepartment && matchesPeriod;
    });
  }, [selectedReport, store, reportType, fromDate, toDate, departmentId, employeeId, payrollPeriodId]);

  function clearFilters() {
    setReportType("");
    setFromDate("");
    setToDate("");
    setDepartmentId("");
    setEmployeeId("");
    setPayrollPeriodId("");
    setGenerated(null);
  }

  function generateReport() {
    if (!selectedReport) {
      toast.error({ title: "Select a report", message: "Choose a report type before generating." });
      return;
    }
    setGenerated({
      reportType,
      filters: { fromDate, toDate, departmentId, employeeId, payrollPeriodId },
      records: reportRecords,
      generatedAt: new Date().toISOString(),
    });
  }

  const filterSummary = generated ? [
    generated.filters.fromDate || generated.filters.toDate ? `Date: ${generated.filters.fromDate || "Any"} – ${generated.filters.toDate || "Any"}` : null,
    generated.filters.departmentId ? `Department: ${getDepartmentLabel(generated.filters.departmentId)}` : null,
    generated.filters.employeeId ? `Employee: ${employeeOptions.find((option) => option.value === generated.filters.employeeId)?.label || generated.filters.employeeId}` : null,
    generated.filters.payrollPeriodId ? `Payroll Period: ${store.payrollPeriods.find((period) => period.id === generated.filters.payrollPeriodId)?.periodName || "—"}` : null,
  ].filter(Boolean) : [];

  return (
    <main className="pp-page">
      <PageHeader eyebrow="PAYROLL REPORTS" title="Payroll Reports" description="Review payroll, attendance, overtime, leave, deductions and employee compensation reporting." />

      <section className="pp-panel pp-panel__body">
        <h2 className="pp-panel__title">Report Types</h2>
        <div className="rep-grid">
          {REPORTS.map((report) => {
            const Icon = report.icon;
            return <button key={report.value} type="button" className={`rep-card${reportType === report.value ? " rep-card--active" : ""}`} onClick={() => { setReportType(report.value); setGenerated(null); }}>
              <span className="rep-card__icon"><Icon size={18} /></span>
              <span className="rep-card__title">{report.label}</span>
              <span className="rep-card__desc">Generate a view from available {report.label.toLowerCase()} records.</span>
            </button>;
          })}
        </div>
      </section>

      <section className="pp-toolbar pp-toolbar--stacked">
        <div className="pp-toolbar__field"><Select label="Report Type" value={reportType} onChange={(value) => { setReportType(value); setGenerated(null); }} options={[{ value: "", label: "Select report type" }, ...REPORTS.map((report) => ({ value: report.value, label: report.label }))]} searchable /></div>
        <div className="pp-toolbar__field"><Input label="From Date" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setGenerated(null); }} /></div>
        <div className="pp-toolbar__field"><Input label="To Date" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setGenerated(null); }} /></div>
        <div className="pp-toolbar__field"><Select label="Department" value={departmentId} onChange={(value) => { setDepartmentId(value); setGenerated(null); }} options={[{ value: "", label: "All Departments" }, ...DEPARTMENTS]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Employee" value={employeeId} onChange={(value) => { setEmployeeId(value); setGenerated(null); }} options={[{ value: "", label: "All Employees" }, ...employeeOptions]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Payroll Period" value={payrollPeriodId} onChange={(value) => { setPayrollPeriodId(value); setGenerated(null); }} options={[{ value: "", label: "All Periods" }, ...store.payrollPeriods.map((period) => ({ value: period.id, label: period.periodName }))]} searchable clearable /></div>
        <div className="pp-toolbar__actions">
          <Button variant="primary" icon={FileBarChart} onClick={generateReport}>Generate Report</Button>
          <Button variant="ghost" icon={X} onClick={clearFilters} disabled={!reportType && !fromDate && !toDate && !departmentId && !employeeId && !payrollPeriodId && !generated}>Clear Filters</Button>
        </div>
      </section>

      <section className="pp-panel">
        <div className="pp-panel__head">
          <h2 className="pp-panel__title">{generated ? REPORTS.find((report) => report.value === generated.reportType)?.label : selectedReport?.label || "Report View"}</h2>
          {generated && <span className="pp-panel__meta">Generated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(generated.generatedAt))}</span>}
        </div>
        {generated && filterSummary.length > 0 && <div className="pp-report-filters"><strong>Applied filters:</strong> {filterSummary.join(" · ")}</div>}
        {!generated ? (
          <div className="pp-empty"><EmptyState icon={FileBarChart} title="Select and generate a report" description="Choose a report type and filters to view available reporting data." /></div>
        ) : !generated.records.length ? (
          <div className="pp-empty"><EmptyState icon={FileBarChart} title="No reporting data available" description="No records match this report and its applied filters." /></div>
        ) : (
          <div className="pp-table-wrap"><table className="pp-table">
            <thead><tr>
              <th>{generated.reportType === "leave-report" ? "Request" : generated.reportType === "advances-loans-report" ? "Employee" : "Employee"}</th>
              <th>Department</th>
              <th>{generated.reportType === "leave-report" ? "Leave Type" : generated.reportType === "deductions-report" ? "Deduction Type" : "Date"}</th>
              <th>{amountHeading(generated.reportType)}</th>
              <th>Status</th>
            </tr></thead>
            <tbody>{generated.records.map((record) => {
              const date = recordDate(record, generated.reportType, store.payrollPeriods);
              const person = generated.reportType === "leave-report" ? record.requestId || record.employeeName : record.employeeName || record.employeeId;
              const detail = generated.reportType === "leave-report"
                ? record.leaveType
                : generated.reportType === "deductions-report"
                  ? record.deductionType
                  : formattedDate(date);
              const amount = recordAmount(record, generated.reportType);
              const displayAmount = generated.reportType === "overtime-report" && amount !== null && amount !== undefined && amount !== ""
                ? `${amount} h`
                : formattedAmount(amount);
              return <tr key={record.id}>
                <td className="pp-table__strong">{person || "—"}</td>
                <td>{record.departmentName || getDepartmentLabel(record.departmentId)}</td>
                <td>{detail || "—"}</td>
                <td>{displayAmount}</td>
                <td>{record.status || "—"}</td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
}
