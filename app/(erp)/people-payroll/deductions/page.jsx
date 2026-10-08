"use client";

import { useMemo, useState } from "react";
import { CircleMinus, Plus, X } from "lucide-react";

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
import { DEDUCTION_STATUSES, DEDUCTION_TYPES } from "@/config/people-payroll";

import "../shared.css";
import "./deductions.css";

const EMPTY_FORM = {
  employeeId: "",
  employeeName: "",
  deductionType: "",
  payrollPeriod: "",
  amount: "",
  reason: "",
  effectiveDate: "",
  status: "pending",
  notes: "",
};

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

export default function DeductionsPage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewDeduction, setViewDeduction] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const employeeOptions = useMemo(
    () => (store.employees || []).map((employee) => ({
      value: employee.employeeId || employee.id,
      label: `${employee.fullName} (${employee.employeeId || "No ID"})`,
    })),
    [store.employees]
  );
  const periodOptions = useMemo(
    () => [...new Set((store.payrollPeriods || []).map((period) => period.periodName).filter(Boolean))].map((periodName) => ({ value: periodName, label: periodName })),
    [store.payrollPeriods]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.deductions || []).filter((deduction) => {
      return (
        (!query || (deduction.employeeName || "").toLowerCase().includes(query) || (deduction.reason || "").toLowerCase().includes(query) || (deduction.notes || "").toLowerCase().includes(query)) &&
        (!employeeFilter || deduction.employeeId === employeeFilter) &&
        (!typeFilter || deduction.deductionType === typeFilter) &&
        (!periodFilter || deduction.payrollPeriod === periodFilter) &&
        (!statusFilter || deduction.status === statusFilter) &&
        (!fromDate || Boolean(deduction.effectiveDate && deduction.effectiveDate >= fromDate)) &&
        (!toDate || Boolean(deduction.effectiveDate && deduction.effectiveDate <= toDate))
      );
    });
  }, [store.deductions, search, employeeFilter, typeFilter, periodFilter, statusFilter, fromDate, toDate]);

  const hasFilters = Boolean(search || employeeFilter || typeFilter || periodFilter || statusFilter || fromDate || toDate);

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

  function openEdit(deduction) {
    setEditingId(deduction.id);
    setForm({
      employeeId: deduction.employeeId || "",
      employeeName: deduction.employeeName || "",
      deductionType: deduction.deductionType || "",
      payrollPeriod: deduction.payrollPeriod || "",
      amount: deduction.amount ?? "",
      reason: deduction.reason || "",
      effectiveDate: deduction.effectiveDate || "",
      status: deduction.status || "pending",
      notes: deduction.notes || "",
    });
    setErrors({});
    setFormOpen(true);
  }

  function validate() {
    const nextErrors = {};
    const amount = Number(form.amount);
    if (!form.employeeId) nextErrors.employeeId = "Employee is required.";
    if (!form.deductionType) nextErrors.deductionType = "Deduction type is required.";
    if (form.amount === "" || !Number.isFinite(amount) || amount <= 0) nextErrors.amount = "Enter a valid amount greater than zero.";
    if (!form.effectiveDate) nextErrors.effectiveDate = "Effective date is required.";
    if (!form.reason.trim()) nextErrors.reason = "Reason is required for manual deductions.";
    return nextErrors;
  }

  async function handleSubmit() {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error({ title: "Cannot save deduction", message: "Please review the highlighted fields." });
      return;
    }
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const employee = (store.employees || []).find((item) => item.employeeId === form.employeeId || item.id === form.employeeId);
    const payload = { ...form, employeeName: employee?.fullName || form.employeeName, amount: Number(form.amount), reason: form.reason.trim() };
    if (editingId) {
      store.updateDeduction(editingId, payload);
      toast.success({ title: "Deduction updated", message: `${payload.employeeName}'s deduction was updated.` });
    } else {
      store.addDeduction(payload);
      toast.success({ title: "Deduction added", message: `${payload.employeeName}'s deduction was added.` });
    }
    setSaving(false);
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function confirmCancel() {
    if (!cancelTarget) return;
    store.cancelDeduction(cancelTarget.id);
    toast.success({ title: "Deduction cancelled", message: `${cancelTarget.employeeName}'s deduction was cancelled.` });
    setCancelTarget(null);
  }

  function clearFilters() {
    setSearch("");
    setEmployeeFilter("");
    setTypeFilter("");
    setPeriodFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
  }

  return (
    <main className="pp-page">
      <PageHeader eyebrow="DEDUCTIONS" title="Deductions" description="Manage payroll deductions, attendance deductions, recoveries and other adjustments." action={<Button variant="primary" icon={Plus} onClick={openCreate}>Add Deduction</Button>} />

      <div className="pp-toolbar pp-toolbar--stacked">
        <div className="pp-toolbar__field pp-toolbar__field--search"><Input label="Search" search clearable value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, reason or notes..." /></div>
        <div className="pp-toolbar__field"><Select label="Employee" value={employeeFilter} onChange={setEmployeeFilter} options={[{ value: "", label: "All Employees" }, ...employeeOptions]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Deduction Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: "", label: "All Types" }, ...DEDUCTION_TYPES]} clearable /></div>
        <div className="pp-toolbar__field"><Select label="Payroll Period" value={periodFilter} onChange={setPeriodFilter} options={[{ value: "", label: "All Periods" }, ...periodOptions]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, ...DEDUCTION_STATUSES]} clearable /></div>
        <div className="pp-toolbar__field"><Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
        <div className="pp-toolbar__field"><Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
        <div className="pp-toolbar__actions"><Button variant="ghost" icon={X} onClick={clearFilters} disabled={!hasFilters}>Clear Filters</Button></div>
        <div className="pp-toolbar__meta"><span><span className="pp-toolbar__count">{filtered.length}</span> deductions</span><span>{store.deductions.length} total records</span></div>
      </div>

      <section className="pp-panel">
        <div className="pp-panel__head"><h2 className="pp-panel__title">Deduction Register</h2></div>
        {!filtered.length ? (
          <div className="pp-empty"><EmptyState icon={CircleMinus} title={store.deductions.length ? "No deductions match your filters" : "No deductions found"} description={store.deductions.length ? "Adjust your search or filter values." : "Deductions will appear here once connected or entered."} action={!store.deductions.length ? <Button variant="primary" icon={Plus} onClick={openCreate}>Add Deduction</Button> : null} /></div>
        ) : (
          <div className="pp-table-wrap"><table className="pp-table">
            <thead><tr><th>Employee</th><th>Deduction Type</th><th>Payroll Period</th><th>Amount</th><th>Reason</th><th>Effective Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((deduction) => (
              <tr key={deduction.id}>
                <td className="pp-table__strong">{deduction.employeeName || deduction.employeeId || "—"}</td>
                <td><span className="dd-type">{DEDUCTION_TYPES.find((type) => type.value === deduction.deductionType)?.label || deduction.deductionType}</span></td>
                <td>{deduction.payrollPeriod || "—"}</td><td className="dd-amount">{money(deduction.amount)}</td><td>{deduction.reason || "—"}</td><td>{deduction.effectiveDate || "—"}</td>
                <td><span className={`dd-status dd-status--${deduction.status}`}>{DEDUCTION_STATUSES.find((status) => status.value === deduction.status)?.label || deduction.status}</span></td>
                <td><div className="pp-actions">
                  <button type="button" className="pp-action-btn" onClick={() => setViewDeduction(deduction)}>View</button>
                  {deduction.status !== "cancelled" && <>
                    <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => openEdit(deduction)}>Edit</button>
                    <button type="button" className="pp-action-btn pp-action-btn--danger" onClick={() => setCancelTarget(deduction)}>Cancel</button>
                  </>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <Modal open={formOpen} onClose={() => { if (!saving) { setFormOpen(false); setForm(EMPTY_FORM); setErrors({}); } }} title={editingId ? "Edit Deduction" : "Add Deduction"} description="Record an actual payroll deduction or adjustment." size="large" loading={saving}
        footer={<div className="pp-modal-footer"><Button variant="ghost" disabled={saving} onClick={() => { setFormOpen(false); setForm(EMPTY_FORM); }}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSubmit}>{editingId ? "Save Changes" : "Save Deduction"}</Button></div>}>
        <div className="pp-form-grid">
          <Select label="Employee" required value={form.employeeId} onChange={handleEmployeeChange} options={employeeOptions} searchable clearable error={errors.employeeId} disabled={saving} />
          <Select label="Deduction Type" required value={form.deductionType} onChange={(value) => setField("deductionType", value)} options={DEDUCTION_TYPES} error={errors.deductionType} disabled={saving} />
          <Select label="Payroll Period" value={form.payrollPeriod} onChange={(value) => setField("payrollPeriod", value)} options={[{ value: "", label: "No period selected" }, ...periodOptions]} clearable disabled={saving} />
          <Input label="Amount" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setField("amount", event.target.value)} error={errors.amount} disabled={saving} />
          <Input label="Effective Date" required type="date" value={form.effectiveDate} onChange={(event) => setField("effectiveDate", event.target.value)} error={errors.effectiveDate} disabled={saving} />
          <Select label="Status" value={form.status} onChange={(value) => setField("status", value)} options={DEDUCTION_STATUSES} disabled={saving} />
          <div className="pp-form-field pp-form-field--full"><Input label="Reason" required value={form.reason} onChange={(event) => setField("reason", event.target.value)} error={errors.reason} disabled={saving} /></div>
          <div className="pp-form-field pp-form-field--full"><Input label="Notes" value={form.notes} onChange={(event) => setField("notes", event.target.value)} disabled={saving} /></div>
        </div>
      </Modal>

      <Drawer open={Boolean(viewDeduction)} onClose={() => setViewDeduction(null)} title="Deduction Details" description={viewDeduction?.employeeName || "Payroll deduction"}>
        {viewDeduction && <div className="pp-detail-grid">
          <div className="pp-detail-item"><span className="pp-detail-item__label">Employee</span><span className="pp-detail-item__value">{viewDeduction.employeeName || viewDeduction.employeeId}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Type</span><span className="pp-detail-item__value">{DEDUCTION_TYPES.find((type) => type.value === viewDeduction.deductionType)?.label || viewDeduction.deductionType}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Amount</span><span className="pp-detail-item__value">{money(viewDeduction.amount)}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Payroll Period</span><span className="pp-detail-item__value">{viewDeduction.payrollPeriod || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Effective Date</span><span className="pp-detail-item__value">{viewDeduction.effectiveDate || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Status</span><span className="pp-detail-item__value">{viewDeduction.status}</span></div>
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Reason</span><span className="pp-detail-item__value">{viewDeduction.reason || "—"}</span></div>
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Notes</span><span className="pp-detail-item__value">{viewDeduction.notes || "—"}</span></div>
        </div>}
      </Drawer>

      <ConfirmDialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} onConfirm={confirmCancel} title="Cancel deduction?" description={cancelTarget ? `${cancelTarget.employeeName}'s deduction will be marked cancelled.` : ""} confirmLabel="Cancel Deduction" variant="danger" />
    </main>
  );
}
