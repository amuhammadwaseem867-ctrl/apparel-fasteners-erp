"use client";

import { useMemo, useState } from "react";
import { CalendarRange, DollarSign, Plus, X } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Drawer from "@/components/ui/Drawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { usePeoplePayrollStore } from "@/lib/usePeoplePayrollStore";
import {
  DEPARTMENTS,
  PAYROLL_STATUSES,
  getDepartmentLabel,
  getPayrollStatusLabel,
  isPayrollTransitionAllowed,
} from "@/config/people-payroll";

import "../shared.css";
import "./payroll.css";

const EMPTY_FORM = { periodName: "", startDate: "", endDate: "", paymentDate: "", status: "draft", notes: "" };
const WORKFLOW = ["Attendance", "Overtime", "Leave / Absence", "Allowances", "Deductions", "Salary Calculation", "Payroll Review", "Approval", "Payslip", "Payroll History"];

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

export default function PayrollPage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewEntry, setViewEntry] = useState(null);
  const [showPayslip, setShowPayslip] = useState(false);
  const [approvePeriodTarget, setApprovePeriodTarget] = useState(null);
  const [approveEntryTarget, setApproveEntryTarget] = useState(null);

  const selectedPeriod =
    store.payrollPeriods.find((period) => period.id === selectedPeriodId) ||
    store.payrollPeriods[0] ||
    null;

  const employeeOptions = useMemo(
    () => (store.employees || []).map((employee) => ({
      value: employee.employeeId || employee.id,
      label: `${employee.fullName} (${employee.employeeId || "No ID"})`,
    })),
    [store.employees]
  );

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.payrollEntries || []).filter((entry) => {
      return (
        (!query || (entry.employeeName || "").toLowerCase().includes(query) || (entry.employeeId || "").toLowerCase().includes(query)) &&
        (!periodFilter || entry.payrollPeriodId === periodFilter) &&
        (!employeeFilter || entry.employeeId === employeeFilter) &&
        (!departmentFilter || entry.departmentId === departmentFilter) &&
        (!statusFilter || entry.status === statusFilter)
      );
    });
  }, [store.payrollEntries, search, periodFilter, employeeFilter, departmentFilter, statusFilter]);

  const hasFilters = Boolean(search || periodFilter || employeeFilter || departmentFilter || statusFilter);
  const selectedPeriodEntries = selectedPeriod
    ? store.payrollEntries.filter((entry) => entry.payrollPeriodId === selectedPeriod.id)
    : [];

  function clearFilters() {
    setSearch("");
    setPeriodFilter("");
    setEmployeeFilter("");
    setDepartmentFilter("");
    setStatusFilter("");
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validatePeriod() {
    const nextErrors = {};
    if (!form.periodName.trim()) nextErrors.periodName = "Period name is required.";
    if (!form.startDate) nextErrors.startDate = "Start date is required.";
    if (!form.endDate) nextErrors.endDate = "End date is required.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) nextErrors.endDate = "End date cannot be before start date.";
    if (form.paymentDate && form.startDate && form.paymentDate < form.startDate) nextErrors.paymentDate = "Payment date cannot be before the period starts.";
    if (store.payrollPeriods.some((period) => period.periodName.trim().toLowerCase() === form.periodName.trim().toLowerCase())) {
      nextErrors.periodName = "A payroll period with this name already exists.";
    }
    return nextErrors;
  }

  async function savePeriod() {
    if (saving) return;
    const nextErrors = validatePeriod();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error({ title: "Cannot create payroll period", message: "Please review the highlighted fields." });
      return;
    }
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const period = store.addPayrollPeriod({ ...form, periodName: form.periodName.trim() });
    setSelectedPeriodId(period.id);
    setPeriodFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
    setSaving(false);
    toast.success({ title: "Payroll period created", message: `${period.periodName} is ready to process.` });
  }

  function changePeriodStatus(period, nextStatus) {
    if (!period || !isPayrollTransitionAllowed(period.status, nextStatus)) {
      toast.error({ title: "Invalid payroll transition", message: `A ${getPayrollStatusLabel(period?.status)} period cannot move to ${getPayrollStatusLabel(nextStatus)}.` });
      return;
    }
    const periodEntries = store.payrollEntries.filter((entry) => entry.payrollPeriodId === period.id);
    const requiredEntryStatus = nextStatus === "paid" ? "approved" : nextStatus === "closed" ? "paid" : null;
    if (requiredEntryStatus && (!periodEntries.length || periodEntries.some((entry) => entry.status !== requiredEntryStatus))) {
      toast.error({ title: "Payroll entries are not ready", message: `Every entry must be ${getPayrollStatusLabel(requiredEntryStatus)} before the period can be ${getPayrollStatusLabel(nextStatus)}.` });
      return;
    }
    store.updatePayrollPeriod(period.id, { status: nextStatus });
    if (nextStatus === "paid" || nextStatus === "closed") {
      periodEntries.forEach((entry) => store.updatePayrollEntry(entry.id, { status: nextStatus }));
    }
    toast.success({ title: "Payroll status updated", message: `${period.periodName} is now ${getPayrollStatusLabel(nextStatus)}.` });
  }

  function changeEntryStatus(entry, nextStatus) {
    if (!isPayrollTransitionAllowed(entry.status, nextStatus)) {
      toast.error({ title: "Invalid payroll transition", message: `A ${getPayrollStatusLabel(entry.status)} entry cannot move to ${getPayrollStatusLabel(nextStatus)}.` });
      return;
    }
    store.updatePayrollEntry(entry.id, { status: nextStatus });
    toast.success({ title: "Payroll entry updated", message: `${entry.employeeName} is now ${getPayrollStatusLabel(nextStatus)}.` });
  }

  function confirmPeriodApproval() {
    if (!approvePeriodTarget) return;
    const entries = store.payrollEntries.filter((entry) => entry.payrollPeriodId === approvePeriodTarget.id);
    if (!entries.length || entries.some((entry) => entry.status !== "approved")) {
      toast.error({ title: "Payroll entries need approval", message: "Approve every payroll entry in this period before approving the period." });
      setApprovePeriodTarget(null);
      return;
    }
    changePeriodStatus(approvePeriodTarget, "approved");
    setApprovePeriodTarget(null);
  }

  function confirmEntryApproval() {
    if (!approveEntryTarget) return;
    changeEntryStatus(approveEntryTarget, "approved");
    setApproveEntryTarget(null);
  }

  function handleReviewPeriod() {
    if (!selectedPeriod) {
      toast.error({ title: "No payroll period selected", message: "Create or select a payroll period first." });
      return;
    }
    if (selectedPeriodEntries.length === 0 || selectedPeriodEntries.some((entry) => entry.status !== "pending-review")) {
      toast.error({ title: "No payroll entries to review", message: "Payroll review is unavailable until actual payroll entries are connected to this period." });
      return;
    }
    changePeriodStatus(selectedPeriod, "pending-review");
  }

  function handleProcessPeriod() {
    if (!selectedPeriod) {
      toast.error({ title: "No payroll period selected", message: "Create or select a payroll period first." });
      return;
    }
    changePeriodStatus(selectedPeriod, "processing");
  }

  return (
    <main className="pp-page">
      <PageHeader
        eyebrow="PAYROLL"
        title="Payroll"
        description="Process employee payroll through attendance, overtime, allowances and deductions."
        action={<div className="pp-toolbar__actions">
          <Button variant="secondary" icon={Plus} onClick={() => { setForm(EMPTY_FORM); setErrors({}); setPeriodFormOpen(true); }}>Create Payroll Period</Button>
          <Button variant="secondary" onClick={handleProcessPeriod} disabled={!selectedPeriod || selectedPeriod.status !== "draft"}>Process Payroll</Button>
          <Button variant="primary" onClick={handleReviewPeriod} disabled={!selectedPeriod || selectedPeriod.status !== "processing"}>Review Payroll</Button>
        </div>}
      />

      <section className="pp-panel pp-panel__body">
        <h2 className="pp-panel__title">Payroll Workflow</h2>
        <div className="pr-steps" aria-label="Payroll workflow">
          {WORKFLOW.map((step, index) => <div className="pr-workflow-item" key={step}>
            <span className="pr-step">{step}</span>
            {index < WORKFLOW.length - 1 && <span className="pr-workflow-arrow" aria-hidden="true">↓</span>}
          </div>)}
        </div>
      </section>

      <section className="pp-panel">
        <div className="pp-panel__head">
          <h2 className="pp-panel__title">Payroll Periods</h2>
          <Button variant="secondary" icon={Plus} onClick={() => { setForm(EMPTY_FORM); setErrors({}); setPeriodFormOpen(true); }}>Create Payroll Period</Button>
        </div>
        {!store.payrollPeriods.length ? (
          <div className="pp-empty"><EmptyState icon={CalendarRange} title="No payroll periods" description="Create a payroll period to begin the payroll workflow." action={<Button variant="primary" icon={Plus} onClick={() => setPeriodFormOpen(true)}>Create Payroll Period</Button>} /></div>
        ) : (
          <div className="pr-periods">
            {store.payrollPeriods.map((period) => (
              <button key={period.id} type="button" className={`pr-period${selectedPeriod?.id === period.id ? " pr-period--active" : ""}`} onClick={() => setSelectedPeriodId(period.id)}>
                <span className="pr-period__name">{period.periodName}</span>
                <span className="pr-period__dates">{formatDate(period.startDate)} – {formatDate(period.endDate)}</span>
                <span className={`pr-status pr-status--${period.status}`}>{getPayrollStatusLabel(period.status)}</span>
              </button>
            ))}
          </div>
        )}
        {selectedPeriod && <div className="pp-panel__body pr-period-actions">
          <div className="pp-detail-item"><span className="pp-detail-item__label">Selected Period</span><span className="pp-detail-item__value">{selectedPeriod.periodName} · {formatDate(selectedPeriod.paymentDate)}</span></div>
          <div className="pp-toolbar__actions">
            {selectedPeriod.status === "pending-review" && <Button variant="primary" onClick={() => setApprovePeriodTarget(selectedPeriod)}>Approve Period</Button>}
            {selectedPeriod.status === "approved" && <Button variant="primary" onClick={() => changePeriodStatus(selectedPeriod, "paid")}>Mark Paid</Button>}
            {selectedPeriod.status === "paid" && <Button variant="secondary" onClick={() => changePeriodStatus(selectedPeriod, "closed")}>Close Period</Button>}
          </div>
        </div>}
      </section>

      <div className="pp-toolbar pp-toolbar--stacked">
        <div className="pp-toolbar__field pp-toolbar__field--search"><Input label="Search" search clearable value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by employee..." /></div>
        <div className="pp-toolbar__field"><Select label="Payroll Period" value={periodFilter} onChange={setPeriodFilter} options={[{ value: "", label: "All Periods" }, ...store.payrollPeriods.map((period) => ({ value: period.id, label: period.periodName }))]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Employee" value={employeeFilter} onChange={setEmployeeFilter} options={[{ value: "", label: "All Employees" }, ...employeeOptions]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: "", label: "All Departments" }, ...DEPARTMENTS]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, ...PAYROLL_STATUSES]} clearable /></div>
        <div className="pp-toolbar__actions"><Button variant="ghost" icon={X} onClick={clearFilters} disabled={!hasFilters}>Clear Filters</Button></div>
        <div className="pp-toolbar__meta"><span><span className="pp-toolbar__count">{filteredEntries.length}</span> payroll entr{filteredEntries.length === 1 ? "y" : "ies"}</span><span>{store.payrollEntries.length} total records</span></div>
      </div>

      <section className="pp-panel">
        <div className="pp-panel__head"><h2 className="pp-panel__title">Payroll Register</h2></div>
        {!filteredEntries.length ? (
          <div className="pp-empty"><EmptyState icon={DollarSign} title="No payroll records" description="Payroll records and actual compensation amounts will appear here when connected." /></div>
        ) : (
          <div className="pp-table-wrap"><table className="pp-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Basic Salary</th><th>Allowances</th><th>Overtime</th><th>Deductions</th><th>Gross Salary</th><th>Net Salary</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filteredEntries.map((entry) => (
              <tr key={entry.id}>
                <td className="pp-table__strong">{entry.employeeName || "—"}</td>
                <td>{entry.departmentName || getDepartmentLabel(entry.departmentId)}</td>
                <td className="pr-amount">{formatAmount(entry.basicSalary)}</td>
                <td className="pr-amount">{formatAmount(entry.allowances)}</td>
                <td className="pr-amount">{formatAmount(entry.overtime)}</td>
                <td className="pr-amount">{formatAmount(entry.deductions)}</td>
                <td className="pr-amount">{formatAmount(entry.grossSalary)}</td>
                <td className="pr-amount">{formatAmount(entry.netSalary)}</td>
                <td><span className={`pr-status pr-status--${entry.status}`}>{getPayrollStatusLabel(entry.status)}</span></td>
                <td><div className="pp-actions">
                  {entry.status === "draft" && <button type="button" className="pp-action-btn" onClick={() => changeEntryStatus(entry, "processing")}>Process</button>}
                  {entry.status === "processing" && <button type="button" className="pp-action-btn" onClick={() => changeEntryStatus(entry, "pending-review")}>Review</button>}
                  {entry.status === "pending-review" && <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => setApproveEntryTarget(entry)}>Approve</button>}
                  <button type="button" className="pp-action-btn" onClick={() => { setViewEntry(entry); setShowPayslip(false); }}>View</button>
                  <button type="button" className="pp-action-btn" onClick={() => { setViewEntry(entry); setShowPayslip(true); }}>Payslip</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <Modal open={periodFormOpen} onClose={() => { if (!saving) { setPeriodFormOpen(false); setForm(EMPTY_FORM); setErrors({}); } }} title="Create Payroll Period" description="Define a payroll cycle and payment date." size="large" loading={saving}
        footer={<div className="pp-modal-footer"><Button variant="ghost" disabled={saving} onClick={() => { setPeriodFormOpen(false); setForm(EMPTY_FORM); }}>Cancel</Button><Button variant="primary" loading={saving} onClick={savePeriod}>Save Period</Button></div>}>
        <div className="pp-form-grid">
          <Input label="Period Name" required value={form.periodName} onChange={(event) => setField("periodName", event.target.value)} error={errors.periodName} disabled={saving} />
          <Select label="Status" value="draft" options={[{ value: "draft", label: "Draft" }]} disabled />
          <Input label="Start Date" required type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} error={errors.startDate} disabled={saving} />
          <Input label="End Date" required type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} error={errors.endDate} disabled={saving} />
          <Input label="Payment Date" type="date" value={form.paymentDate} onChange={(event) => setField("paymentDate", event.target.value)} error={errors.paymentDate} disabled={saving} />
          <div className="pp-form-field pp-form-field--full"><Input label="Notes" value={form.notes} onChange={(event) => setField("notes", event.target.value)} disabled={saving} /></div>
        </div>
      </Modal>

      <Drawer open={Boolean(viewEntry)} onClose={() => { setViewEntry(null); setShowPayslip(false); }} title={showPayslip ? "Payslip" : "Payroll Entry"} description={viewEntry ? `${viewEntry.employeeName || "Employee"} · ${getPayrollStatusLabel(viewEntry.status)}` : ""}>
        {viewEntry && <div className="pp-detail-grid">
          <div className="pp-detail-item"><span className="pp-detail-item__label">Employee ID</span><span className="pp-detail-item__value">{viewEntry.employeeId || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Department</span><span className="pp-detail-item__value">{viewEntry.departmentName || getDepartmentLabel(viewEntry.departmentId)}</span></div>
          {[
            ["Basic Salary", viewEntry.basicSalary],
            ["Allowances", viewEntry.allowances],
            ["Overtime", viewEntry.overtime],
            ["Deductions", viewEntry.deductions],
            ["Gross Salary", viewEntry.grossSalary],
            ["Net Salary", viewEntry.netSalary],
          ].map(([label, amount]) => <div className="pp-detail-item" key={label}><span className="pp-detail-item__label">{label}</span><span className="pp-detail-item__value">{formatAmount(amount)}</span></div>)}
          {showPayslip && <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Payslip status</span><span className="pp-detail-item__value">Payslip details shown from this payroll record.</span></div>}
        </div>}
      </Drawer>

      <ConfirmDialog open={Boolean(approvePeriodTarget)} onClose={() => setApprovePeriodTarget(null)} onConfirm={confirmPeriodApproval} title="Approve payroll period?" description={approvePeriodTarget ? `${approvePeriodTarget.periodName} will be approved.` : ""} confirmLabel="Approve Period" variant="success" />
      <ConfirmDialog open={Boolean(approveEntryTarget)} onClose={() => setApproveEntryTarget(null)} onConfirm={confirmEntryApproval} title="Approve payroll entry?" description={approveEntryTarget ? `${approveEntryTarget.employeeName}'s payroll entry will be approved.` : ""} confirmLabel="Approve" variant="success" />
    </main>
  );
}
