"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Plus, X } from "lucide-react";

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
import { SALARY_STRUCTURE_STATUSES } from "@/config/people-payroll";

import "../shared.css";
import "./salary-structure.css";

const EMPTY_FORM = {
  name: "",
  employeeOrGroup: "",
  basicSalary: "",
  housingAllowance: "",
  transportAllowance: "",
  medicalAllowance: "",
  otherAllowances: "",
  overtimeRule: "",
  deductionRules: "",
  effectiveFrom: "",
  effectiveTo: "",
  status: "active",
};

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

export default function SalaryStructurePage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [effectiveFilter, setEffectiveFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewStructure, setViewStructure] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const employeeOptions = useMemo(
    () => (store.employees || []).map((employee) => ({
      value: employee.employeeId || employee.id,
      label: `${employee.fullName} (${employee.employeeId || "No ID"})`,
    })),
    [store.employees]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.salaryStructures || []).filter((structure) => {
      const target = (structure.employeeOrGroup || "").toLowerCase();
      const matchesEmployee = !employeeFilter || target === employeeFilter.toLowerCase() ||
        (store.employees || []).some((employee) =>
          (employee.employeeId === employeeFilter || employee.id === employeeFilter) &&
          target === (employee.fullName || "").toLowerCase()
        );
      return (
        (!query || (structure.name || "").toLowerCase().includes(query) || target.includes(query)) &&
        matchesEmployee &&
        (!statusFilter || structure.status === statusFilter) &&
        (!effectiveFilter || !structure.effectiveFrom || structure.effectiveFrom <= effectiveFilter)
      );
    });
  }, [store.salaryStructures, store.employees, search, employeeFilter, statusFilter, effectiveFilter]);

  const hasFilters = Boolean(search || employeeFilter || statusFilter || effectiveFilter);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(structure) {
    setEditingId(structure.id);
    setForm({
      name: structure.name || "",
      employeeOrGroup: structure.employeeOrGroup || "",
      basicSalary: structure.basicSalary ?? "",
      housingAllowance: structure.housingAllowance ?? "",
      transportAllowance: structure.transportAllowance ?? "",
      medicalAllowance: structure.medicalAllowance ?? "",
      otherAllowances: structure.otherAllowances ?? "",
      overtimeRule: structure.overtimeRule || "",
      deductionRules: structure.deductionRules || "",
      effectiveFrom: structure.effectiveFrom || "",
      effectiveTo: structure.effectiveTo || "",
      status: structure.status || "active",
    });
    setErrors({});
    setFormOpen(true);
  }

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Structure name is required.";
    if (!form.employeeOrGroup.trim()) nextErrors.employeeOrGroup = "Employee or group is required.";
    const basic = Number(form.basicSalary);
    if (form.basicSalary === "" || !Number.isFinite(basic) || basic <= 0) nextErrors.basicSalary = "Enter a valid basic salary greater than zero.";
    ["housingAllowance", "transportAllowance", "medicalAllowance", "otherAllowances"].forEach((key) => {
      const value = form[key];
      if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) nextErrors[key] = "Enter a valid non-negative amount.";
    });
    if (!form.effectiveFrom) nextErrors.effectiveFrom = "Effective-from date is required.";
    if (form.effectiveTo && form.effectiveFrom && form.effectiveTo < form.effectiveFrom) nextErrors.effectiveTo = "Effective-to date cannot be before effective-from date.";
    return nextErrors;
  }

  async function handleSubmit() {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error({ title: "Cannot save salary structure", message: "Please review the highlighted fields." });
      return;
    }
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const payload = {
      ...form,
      name: form.name.trim(),
      employeeOrGroup: form.employeeOrGroup.trim(),
      basicSalary: Number(form.basicSalary),
      housingAllowance: form.housingAllowance === "" ? null : Number(form.housingAllowance),
      transportAllowance: form.transportAllowance === "" ? null : Number(form.transportAllowance),
      medicalAllowance: form.medicalAllowance === "" ? null : Number(form.medicalAllowance),
      otherAllowances: form.otherAllowances === "" ? null : Number(form.otherAllowances),
    };
    if (editingId) {
      store.updateSalaryStructure(editingId, payload);
      toast.success({ title: "Salary structure updated", message: `${payload.name} has been updated.` });
    } else {
      store.addSalaryStructure(payload);
      toast.success({ title: "Salary structure created", message: `${payload.name} has been added.` });
    }
    setSaving(false);
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function toggleActive(structure) {
    store.toggleSalaryStructureStatus(structure.id);
    toast.success({ title: "Status changed", message: `${structure.name} is now active.` });
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    store.toggleSalaryStructureStatus(deactivateTarget.id);
    toast.success({ title: "Salary structure deactivated", message: `${deactivateTarget.name} is now inactive.` });
    setDeactivateTarget(null);
  }

  function clearFilters() {
    setSearch("");
    setEmployeeFilter("");
    setStatusFilter("");
    setEffectiveFilter("");
  }

  return (
    <main className="pp-page">
      <PageHeader eyebrow="SALARY STRUCTURE" title="Salary Structure" description="Define employee compensation structures, allowances, overtime and deductions." action={<Button variant="primary" icon={Plus} onClick={openCreate}>Add Salary Structure</Button>} />

      <div className="pp-toolbar pp-toolbar--stacked">
        <div className="pp-toolbar__field pp-toolbar__field--search"><Input label="Search" search clearable value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search structure or employee/group..." /></div>
        <div className="pp-toolbar__field"><Select label="Employee" value={employeeFilter} onChange={setEmployeeFilter} options={[{ value: "", label: "All Employees" }, ...employeeOptions]} searchable clearable /></div>
        <div className="pp-toolbar__field"><Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, ...SALARY_STRUCTURE_STATUSES]} clearable /></div>
        <div className="pp-toolbar__field"><Input label="Effective on" type="date" value={effectiveFilter} onChange={(event) => setEffectiveFilter(event.target.value)} /></div>
        <div className="pp-toolbar__actions"><Button variant="ghost" icon={X} onClick={clearFilters} disabled={!hasFilters}>Clear Filters</Button></div>
        <div className="pp-toolbar__meta"><span><span className="pp-toolbar__count">{filtered.length}</span> structures</span><span>{store.salaryStructures.length} total records</span></div>
      </div>

      <section className="pp-panel">
        <div className="pp-panel__head"><h2 className="pp-panel__title">Compensation Structures</h2></div>
        {!filtered.length ? (
          <div className="pp-empty"><EmptyState icon={CircleDollarSign} title={store.salaryStructures.length ? "No salary structures match your filters" : "No salary structures configured"} description={store.salaryStructures.length ? "Adjust your search or filter values." : "Salary structures will appear here once configured."} action={!store.salaryStructures.length ? <Button variant="primary" icon={Plus} onClick={openCreate}>Add Salary Structure</Button> : null} /></div>
        ) : (
          <div className="pp-table-wrap"><table className="pp-table">
            <thead><tr><th>Structure Name</th><th>Employee / Group</th><th>Basic Salary</th><th>Allowances</th><th>Overtime Rule</th><th>Deductions</th><th>Effective From</th><th>Effective To</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((structure) => {
              const allowanceValues = [structure.housingAllowance, structure.transportAllowance, structure.medicalAllowance, structure.otherAllowances].filter((value) => value !== null && value !== undefined && value !== "");
              const allowances = allowanceValues.length ? allowanceValues.reduce((total, value) => total + Number(value), 0) : null;
              return <tr key={structure.id}>
                <td className="ss-name">{structure.name}</td><td>{structure.employeeOrGroup || "—"}</td><td className="ss-amount">{money(structure.basicSalary)}</td><td className="ss-amount">{money(allowances)}</td>
                <td>{structure.overtimeRule || "—"}</td><td>{structure.deductionRules || "—"}</td><td>{structure.effectiveFrom || "—"}</td><td>{structure.effectiveTo || "—"}</td>
                <td><span className={`ss-status ss-status--${structure.status}`}>{structure.status}</span></td>
                <td><div className="pp-actions">
                  <button type="button" className="pp-action-btn" onClick={() => setViewStructure(structure)}>View</button>
                  <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => openEdit(structure)}>Edit</button>
                  {structure.status === "active"
                    ? <button type="button" className="pp-action-btn pp-action-btn--danger" onClick={() => setDeactivateTarget(structure)}>Deactivate</button>
                    : <button type="button" className="pp-action-btn" onClick={() => toggleActive(structure)}>Activate</button>}
                </div></td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </section>

      <Modal open={formOpen} onClose={() => { if (!saving) { setFormOpen(false); setForm(EMPTY_FORM); setErrors({}); } }} title={editingId ? "Edit Salary Structure" : "Add Salary Structure"} description="Enter actual compensation values for an employee or group." size="large" loading={saving}
        footer={<div className="pp-modal-footer"><Button variant="ghost" disabled={saving} onClick={() => { setFormOpen(false); setForm(EMPTY_FORM); }}>Cancel</Button><Button variant="primary" loading={saving} onClick={handleSubmit}>{editingId ? "Save Changes" : "Save Structure"}</Button></div>}>
        <div className="pp-form-grid">
          <Input label="Structure Name" required value={form.name} onChange={(event) => setField("name", event.target.value)} error={errors.name} disabled={saving} />
          <Input label="Employee / Employee Group" required value={form.employeeOrGroup} onChange={(event) => setField("employeeOrGroup", event.target.value)} error={errors.employeeOrGroup} disabled={saving} placeholder="Employee ID or group name" />
          <Input label="Basic Salary" required type="number" min="0.01" step="0.01" value={form.basicSalary} onChange={(event) => setField("basicSalary", event.target.value)} error={errors.basicSalary} disabled={saving} />
          <Input label="Housing Allowance" type="number" min="0" step="0.01" value={form.housingAllowance} onChange={(event) => setField("housingAllowance", event.target.value)} error={errors.housingAllowance} disabled={saving} />
          <Input label="Transport Allowance" type="number" min="0" step="0.01" value={form.transportAllowance} onChange={(event) => setField("transportAllowance", event.target.value)} error={errors.transportAllowance} disabled={saving} />
          <Input label="Medical Allowance" type="number" min="0" step="0.01" value={form.medicalAllowance} onChange={(event) => setField("medicalAllowance", event.target.value)} error={errors.medicalAllowance} disabled={saving} />
          <Input label="Other Allowances" type="number" min="0" step="0.01" value={form.otherAllowances} onChange={(event) => setField("otherAllowances", event.target.value)} error={errors.otherAllowances} disabled={saving} />
          <Input label="Overtime Rule" value={form.overtimeRule} onChange={(event) => setField("overtimeRule", event.target.value)} disabled={saving} />
          <Input label="Deduction Rules" value={form.deductionRules} onChange={(event) => setField("deductionRules", event.target.value)} disabled={saving} />
          <Input label="Effective From" required type="date" value={form.effectiveFrom} onChange={(event) => setField("effectiveFrom", event.target.value)} error={errors.effectiveFrom} disabled={saving} />
          <Input label="Effective To" type="date" value={form.effectiveTo} onChange={(event) => setField("effectiveTo", event.target.value)} error={errors.effectiveTo} disabled={saving} />
          <Select label="Status" value={form.status} onChange={(value) => setField("status", value)} options={SALARY_STRUCTURE_STATUSES} disabled={saving} />
        </div>
      </Modal>

      <Drawer open={Boolean(viewStructure)} onClose={() => setViewStructure(null)} title={viewStructure?.name || "Salary structure"} description="Compensation structure details">
        {viewStructure && <div className="pp-detail-grid">
          <div className="pp-detail-item"><span className="pp-detail-item__label">Employee / Group</span><span className="pp-detail-item__value">{viewStructure.employeeOrGroup || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Status</span><span className="pp-detail-item__value">{viewStructure.status}</span></div>
          {[["Basic Salary", viewStructure.basicSalary], ["Housing Allowance", viewStructure.housingAllowance], ["Transport Allowance", viewStructure.transportAllowance], ["Medical Allowance", viewStructure.medicalAllowance], ["Other Allowances", viewStructure.otherAllowances]].map(([label, value]) => <div className="pp-detail-item" key={label}><span className="pp-detail-item__label">{label}</span><span className="pp-detail-item__value">{money(value)}</span></div>)}
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Overtime Rule</span><span className="pp-detail-item__value">{viewStructure.overtimeRule || "—"}</span></div>
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Deduction Rules</span><span className="pp-detail-item__value">{viewStructure.deductionRules || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Effective From</span><span className="pp-detail-item__value">{viewStructure.effectiveFrom || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Effective To</span><span className="pp-detail-item__value">{viewStructure.effectiveTo || "—"}</span></div>
        </div>}
      </Drawer>

      <ConfirmDialog open={Boolean(deactivateTarget)} onClose={() => setDeactivateTarget(null)} onConfirm={confirmDeactivate} title="Deactivate salary structure?" description={deactivateTarget ? `${deactivateTarget.name} will be marked inactive.` : ""} confirmLabel="Deactivate" variant="danger" />
    </main>
  );
}
