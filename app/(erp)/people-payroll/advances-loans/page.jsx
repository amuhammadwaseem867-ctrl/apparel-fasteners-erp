"use client";

import { useMemo, useState } from "react";
import { Banknote, Plus, X } from "lucide-react";

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
import { ADVANCE_LOAN_STATUSES } from "@/config/people-payroll";

import "../shared.css";
import "./advances-loans.css";

const TYPES = [
  { value: "salary-advance", label: "Salary Advance" },
  { value: "employee-loan", label: "Employee Loan" },
  { value: "other", label: "Other" },
];
const EMPTY_FORM = {
  employeeId: "",
  employeeName: "",
  type: "",
  requestDate: "",
  amount: "",
  installmentAmount: "",
  numberOfInstallments: "",
  startDate: "",
  remarks: "",
};
const EMPTY_RECOVERY = { recoveryDate: "", amount: "", payrollPeriod: "", remarks: "" };
const ACTIONS = {
  approve: { title: "Approve advance / loan?", confirmLabel: "Approve", variant: "success" },
  reject: { title: "Reject advance / loan?", confirmLabel: "Reject", variant: "danger" },
  cancel: { title: "Cancel advance / loan?", confirmLabel: "Cancel Request", variant: "warning" },
};

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

export default function AdvancesLoansPage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [recoveryTarget, setRecoveryTarget] = useState(null);
  const [recovery, setRecovery] = useState(EMPTY_RECOVERY);
  const [recoveryErrors, setRecoveryErrors] = useState({});
  const [recoverySaving, setRecoverySaving] = useState(false);

  const employeeOptions = useMemo(
    () => (store.employees || []).map((employee) => ({
      value: employee.employeeId || employee.id,
      label: `${employee.fullName} (${employee.employeeId || "No ID"})`,
    })),
    [store.employees]
  );
  const payrollPeriods = useMemo(
    () => (store.payrollPeriods || []).map((period) => ({ value: period.periodName, label: period.periodName })).filter((item) => item.value),
    [store.payrollPeriods]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.advancesLoans || []).filter((record) => (
      (!query || (record.employeeName || "").toLowerCase().includes(query) || (record.remarks || "").toLowerCase().includes(query)) &&
      (!employeeFilter || record.employeeId === employeeFilter) &&
      (!typeFilter || record.type === typeFilter) &&
      (!statusFilter || record.status === statusFilter) &&
      (!fromDate || Boolean(record.requestDate && record.requestDate >= fromDate)) &&
      (!toDate || Boolean(record.requestDate && record.requestDate <= toDate))
    ));
  }, [store.advancesLoans, search, employeeFilter, typeFilter, statusFilter, fromDate, toDate]);

  const hasFilters = Boolean(search || employeeFilter || typeFilter || statusFilter || fromDate || toDate);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleEmployeeChange(value) {
    const employee = (store.employees || []).find((item) => item.employeeId === value || item.id === value);
    setForm((current) => ({
      ...current,
      employeeId: employee ? employee.employeeId || employee.id : value,
      employeeName: employee ? employee.fullName : "",
    }));
    setErrors((current) => ({ ...current, employeeId: undefined }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(record) {
    setEditingId(record.id);
    setForm({
      employeeId: record.employeeId || "",
      employeeName: record.employeeName || "",
      type: record.type || "",
      requestDate: record.requestDate || "",
      amount: record.amount ?? "",
      installmentAmount: record.installmentAmount ?? "",
      numberOfInstallments: record.numberOfInstallments ?? "",
      startDate: record.startDate || "",
      remarks: record.remarks || "",
    });
    setErrors({});
    setFormOpen(true);
  }

  function validate() {
    const nextErrors = {};
    const amount = Number(form.amount);
    const installment = Number(form.installmentAmount);
    const count = Number(form.numberOfInstallments);
    if (!form.employeeId) nextErrors.employeeId = "Employee is required.";
    if (!form.type) nextErrors.type = "Type is required.";
    if (!form.requestDate) nextErrors.requestDate = "Request date is required.";
    if (form.amount === "" || !Number.isFinite(amount) || amount <= 0) nextErrors.amount = "Enter a valid amount greater than zero.";
    if (form.installmentAmount === "" || !Number.isFinite(installment) || installment <= 0 || installment > amount) nextErrors.installmentAmount = "Installment must be positive and cannot exceed the amount.";
    if (form.numberOfInstallments === "" || !Number.isInteger(count) || count < 1) nextErrors.numberOfInstallments = "Enter a whole number of installments.";
    else if (installment * count < amount) nextErrors.numberOfInstallments = "Installments must cover the full requested amount.";
    if (!form.startDate) nextErrors.startDate = "Recovery start date is required.";
    if (form.startDate && form.requestDate && form.startDate < form.requestDate) nextErrors.startDate = "Start date cannot be before the request date.";
    return nextErrors;
  }

  async function handleSubmit() {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error({ title: "Cannot save advance / loan", message: "Please review the highlighted fields." });
      return;
    }
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const employee = (store.employees || []).find((item) => item.employeeId === form.employeeId || item.id === form.employeeId);
    const payload = {
      ...form,
      employeeName: employee?.fullName || form.employeeName,
      amount: Number(form.amount),
      installmentAmount: Number(form.installmentAmount),
      numberOfInstallments: Number(form.numberOfInstallments),
      outstandingBalance: Number(form.amount),
    };
    if (editingId) {
      store.updateAdvanceLoan(editingId, payload);
      toast.success({ title: "Advance / loan updated", message: `${payload.employeeName}'s request was updated.` });
    } else {
      store.addAdvanceLoan(payload);
      toast.success({ title: "Advance / loan requested", message: `${payload.employeeName}'s request was submitted.` });
    }
    setSaving(false);
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function openAction(action, record) {
    setActionTarget({ action, record });
  }

  function confirmAction() {
    if (!actionTarget) return;
    const { action, record } = actionTarget;
    const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
    store.updateAdvanceLoan(record.id, { status });
    toast.success({ title: `Request ${status}`, message: `${record.employeeName}'s request is ${status}.` });
    setActionTarget(null);
  }

  function validateRecovery() {
    const nextErrors = {};
    const amount = Number(recovery.amount);
    if (!recovery.recoveryDate) nextErrors.recoveryDate = "Recovery date is required.";
    if (recovery.amount === "" || !Number.isFinite(amount) || amount <= 0) nextErrors.amount = "Enter a valid recovery amount greater than zero.";
    if (recoveryTarget && amount > Number(recoveryTarget.outstandingBalance || 0)) nextErrors.amount = "Recovery cannot exceed the outstanding balance.";
    return nextErrors;
  }

  async function submitRecovery() {
    if (recoverySaving || !recoveryTarget) return;
    const nextErrors = validateRecovery();
    if (Object.keys(nextErrors).length) {
      setRecoveryErrors(nextErrors);
      toast.error({ title: "Cannot record recovery", message: "Please review the highlighted fields." });
      return;
    }
    setRecoverySaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    store.recordRecovery(recoveryTarget.id, Number(recovery.amount), {
      recoveryDate: recovery.recoveryDate,
      payrollPeriod: recovery.payrollPeriod,
      remarks: recovery.remarks.trim(),
    });
    toast.success({ title: "Recovery recorded", message: `${money(recovery.amount)} was recovered from ${recoveryTarget.employeeName}.` });
    setRecoverySaving(false);
    setRecoveryTarget(null);
    setRecovery(EMPTY_RECOVERY);
    setRecoveryErrors({});
  }

  function clearFilters() {
    setSearch("");
    setEmployeeFilter("");
    setTypeFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
  }

  const actionCopy = actionTarget ? ACTIONS[actionTarget.action] : null;

  return (
    <main className="pp-page">
      <PageHeader eyebrow="ADVANCES & LOANS" title="Advances & Loans" description="Manage employee salary advances, loans, repayments and outstanding balances." action={<Button variant="primary" icon={Plus} onClick={openCreate}>New Advance / Loan</Button>} />

      <div className="pp-toolbar pp-toolbar--stacked">
        <div className="pp-toolbar__field pp-toolbar__field--search"><Input label="Search" search clearable value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee or remarks..." /></div>
        <div className="pp-toolbar__field"><Select label="Employee" value={employeeFilter} onChange={setEmployeeFilter} options={[{ value: "", label: "All Employees" }, ...employeeOptions]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: "", label: "All Types" }, ...TYPES]} clearable /></div>
        <div className="pp-toolbar__field"><Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, ...ADVANCE_LOAN_STATUSES]} clearable /></div>
        <div className="pp-toolbar__field"><Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
        <div className="pp-toolbar__field"><Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
        <div className="pp-toolbar__actions"><Button variant="ghost" icon={X} onClick={clearFilters} disabled={!hasFilters}>Clear Filters</Button></div>
        <div className="pp-toolbar__meta"><span><span className="pp-toolbar__count">{filtered.length}</span> advances / loans</span><span>{store.advancesLoans.length} total records</span></div>
      </div>

      <section className="pp-panel">
        <div className="pp-panel__head"><h2 className="pp-panel__title">Advances & Loans Register</h2></div>
        {!filtered.length ? (
          <div className="pp-empty"><EmptyState icon={Banknote} title={store.advancesLoans.length ? "No advances or loans match your filters" : "No advances or loans found"} description={store.advancesLoans.length ? "Adjust your search or filter values." : "Advance and loan requests will appear here once connected or submitted."} action={!store.advancesLoans.length ? <Button variant="primary" icon={Plus} onClick={openCreate}>New Advance / Loan</Button> : null} /></div>
        ) : (
          <div className="pp-table-wrap"><table className="pp-table">
            <thead><tr><th>Employee</th><th>Type</th><th>Request Date</th><th>Amount</th><th>Installment</th><th>Installments</th><th>Outstanding Balance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((record) => (
              <tr key={record.id}>
                <td className="pp-table__strong">{record.employeeName || record.employeeId || "—"}</td>
                <td><span className="al-type">{TYPES.find((type) => type.value === record.type)?.label || record.type}</span></td>
                <td>{record.requestDate || "—"}</td><td className="al-amount">{money(record.amount)}</td><td className="al-amount">{money(record.installmentAmount)}</td><td>{record.numberOfInstallments ?? "—"}</td><td className="al-amount">{money(record.outstandingBalance)}</td>
                <td><span className={`al-status al-status--${record.status}`}>{ADVANCE_LOAN_STATUSES.find((status) => status.value === record.status)?.label || record.status}</span></td>
                <td><div className="pp-actions">
                  <button type="button" className="pp-action-btn" onClick={() => setViewRecord(record)}>View</button>
                  {record.status === "requested" && <>
                    <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => openAction("approve", record)}>Approve</button>
                    <button type="button" className="pp-action-btn pp-action-btn--danger" onClick={() => openAction("reject", record)}>Reject</button>
                    <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => openEdit(record)}>Edit</button>
                    <button type="button" className="pp-action-btn" onClick={() => openAction("cancel", record)}>Cancel</button>
                  </>}
                  {["approved", "active", "partially-recovered"].includes(record.status) && <>
                    {record.status === "approved" && <button type="button" className="pp-action-btn" onClick={() => { store.updateAdvanceLoan(record.id, { status: "active" }); toast.success({ title: "Request activated", message: `${record.employeeName}'s request is now active.` }); }}>Activate</button>}
                    <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => { setRecoveryTarget(record); setRecovery(EMPTY_RECOVERY); setRecoveryErrors({}); }}>Record Recovery</button>
                    <button type="button" className="pp-action-btn pp-action-btn--danger" onClick={() => openAction("cancel", record)}>Cancel</button>
                  </>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <Modal open={formOpen} onClose={() => { if (!saving) { setFormOpen(false); setForm(EMPTY_FORM); setErrors({}); } }} title={editingId ? "Edit Advance / Loan" : "New Advance / Loan"} description="Submit a request using actual employee and financial values." size="large" loading={saving}
        footer={<div className="pp-modal-footer"><Button variant="ghost" disabled={saving} onClick={() => { setFormOpen(false); setForm(EMPTY_FORM); }}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSubmit}>{editingId ? "Save Changes" : "Submit Request"}</Button></div>}>
        <div className="pp-form-grid">
          <Select label="Employee" required value={form.employeeId} onChange={handleEmployeeChange} options={employeeOptions} searchable clearable error={errors.employeeId} disabled={saving} />
          <Select label="Type" required value={form.type} onChange={(value) => setField("type", value)} options={TYPES} error={errors.type} disabled={saving} />
          <Input label="Request Date" required type="date" value={form.requestDate} onChange={(event) => setField("requestDate", event.target.value)} error={errors.requestDate} disabled={saving} />
          <Input label="Amount" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setField("amount", event.target.value)} error={errors.amount} disabled={saving} />
          <Input label="Installment Amount" required type="number" min="0.01" step="0.01" value={form.installmentAmount} onChange={(event) => setField("installmentAmount", event.target.value)} error={errors.installmentAmount} disabled={saving} />
          <Input label="Number of Installments" required type="number" min="1" step="1" value={form.numberOfInstallments} onChange={(event) => setField("numberOfInstallments", event.target.value)} error={errors.numberOfInstallments} disabled={saving} />
          <Input label="Start Date" required type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} error={errors.startDate} disabled={saving} />
          <div className="pp-form-field pp-form-field--full"><Input label="Remarks" value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} disabled={saving} /></div>
        </div>
      </Modal>

      <Modal open={Boolean(recoveryTarget)} onClose={() => { if (!recoverySaving) { setRecoveryTarget(null); setRecovery(EMPTY_RECOVERY); setRecoveryErrors({}); } }} title="Record Recovery" description={recoveryTarget ? `Outstanding balance: ${money(recoveryTarget.outstandingBalance)}` : ""} size="medium" loading={recoverySaving}
        footer={<div className="pp-modal-footer"><Button variant="ghost" disabled={recoverySaving} onClick={() => { setRecoveryTarget(null); setRecovery(EMPTY_RECOVERY); }}>Cancel</Button><Button variant="primary" loading={recoverySaving} onClick={submitRecovery}>Save Recovery</Button></div>}>
        <div className="pp-form-grid">
          <Input label="Recovery Date" required type="date" value={recovery.recoveryDate} onChange={(event) => { setRecovery((current) => ({ ...current, recoveryDate: event.target.value })); setRecoveryErrors((current) => ({ ...current, recoveryDate: undefined })); }} error={recoveryErrors.recoveryDate} disabled={recoverySaving} />
          <Input label="Amount" required type="number" min="0.01" step="0.01" value={recovery.amount} onChange={(event) => { setRecovery((current) => ({ ...current, amount: event.target.value })); setRecoveryErrors((current) => ({ ...current, amount: undefined })); }} error={recoveryErrors.amount} disabled={recoverySaving} />
          <Select label="Payroll Period" value={recovery.payrollPeriod} onChange={(value) => setRecovery((current) => ({ ...current, payrollPeriod: value }))} options={[{ value: "", label: "No period selected" }, ...payrollPeriods]} clearable disabled={recoverySaving} />
          <div className="pp-form-field pp-form-field--full"><Input label="Remarks" value={recovery.remarks} onChange={(event) => setRecovery((current) => ({ ...current, remarks: event.target.value }))} disabled={recoverySaving} /></div>
        </div>
      </Modal>

      <Drawer open={Boolean(viewRecord)} onClose={() => setViewRecord(null)} title={viewRecord?.employeeName || "Advance / Loan"} description={viewRecord ? TYPES.find((type) => type.value === viewRecord.type)?.label || viewRecord.type : ""}>
        {viewRecord && <div className="pp-detail-grid">
          <div className="pp-detail-item"><span className="pp-detail-item__label">Request Date</span><span className="pp-detail-item__value">{viewRecord.requestDate || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Status</span><span className="pp-detail-item__value">{viewRecord.status}</span></div>
          {[["Amount", viewRecord.amount], ["Installment", viewRecord.installmentAmount], ["Outstanding Balance", viewRecord.outstandingBalance]].map(([label, value]) => <div className="pp-detail-item" key={label}><span className="pp-detail-item__label">{label}</span><span className="pp-detail-item__value">{money(value)}</span></div>)}
          <div className="pp-detail-item"><span className="pp-detail-item__label">Installments</span><span className="pp-detail-item__value">{viewRecord.numberOfInstallments ?? "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Recovery Start</span><span className="pp-detail-item__value">{viewRecord.startDate || "—"}</span></div>
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Remarks</span><span className="pp-detail-item__value">{viewRecord.remarks || "—"}</span></div>
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Recovery History</span>
            {viewRecord.recoveryHistory?.length ? viewRecord.recoveryHistory.map((item, index) => <span className="pp-detail-item__value" key={`${item.createdAt}-${index}`}>{item.recoveryDate || "—"} · {money(item.amount)} · {item.payrollPeriod || "No payroll period"}{item.remarks ? ` · ${item.remarks}` : ""}</span>) : <span className="pp-detail-item__value">No recoveries recorded.</span>}
          </div>
        </div>}
      </Drawer>

      <ConfirmDialog open={Boolean(actionTarget)} onClose={() => setActionTarget(null)} onConfirm={confirmAction} title={actionCopy?.title} description={actionTarget ? `${actionTarget.record.employeeName}'s request will be ${actionTarget.action === "approve" ? "approved" : actionTarget.action === "reject" ? "rejected" : "cancelled"}.` : ""} confirmLabel={actionCopy?.confirmLabel} variant={actionCopy?.variant} />
    </main>
  );
}
