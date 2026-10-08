"use client";

import { useMemo, useState } from "react";
import { Clock3, Plus, X } from "lucide-react";

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
import { SHIFT_STATUSES } from "@/config/people-payroll";

import "../shared.css";
import "./shifts.css";

const EMPTY_FORM = {
  code: "",
  name: "",
  startTime: "",
  endTime: "",
  breakDuration: "",
  gracePeriod: "",
  workingHours: "",
  status: "active",
  remarks: "",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  ...SHIFT_STATUSES.map((status) => ({ value: status.value, label: status.label })),
];

function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export default function ShiftsPage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewShift, setViewShift] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.shifts || []).filter((shift) => {
      const matchesSearch =
        !query ||
        (shift.code || "").toLowerCase().includes(query) ||
        (shift.name || "").toLowerCase().includes(query) ||
        (shift.remarks || "").toLowerCase().includes(query);
      return matchesSearch && (!statusFilter || shift.status === statusFilter);
    });
  }, [store.shifts, search, statusFilter]);

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

  function openEdit(shift) {
    setEditingId(shift.id);
    setForm({
      code: shift.code || "",
      name: shift.name || "",
      startTime: shift.startTime || "",
      endTime: shift.endTime || "",
      breakDuration: shift.breakDuration ?? "",
      gracePeriod: shift.gracePeriod ?? "",
      workingHours: shift.workingHours ?? "",
      status: shift.status || "active",
      remarks: shift.remarks || "",
    });
    setErrors({});
    setFormOpen(true);
  }

  function validate() {
    const nextErrors = {};
    const start = timeToMinutes(form.startTime);
    const end = timeToMinutes(form.endTime);
    const breakDuration = Number(form.breakDuration);
    const gracePeriod = Number(form.gracePeriod);
    const workingHours = Number(form.workingHours);

    if (!form.code.trim()) nextErrors.code = "Shift code is required.";
    if (!form.name.trim()) nextErrors.name = "Shift name is required.";
    if (start === null) nextErrors.startTime = "Enter a valid start time.";
    if (end === null) nextErrors.endTime = "Enter a valid end time.";
    else if (start !== null && end <= start) nextErrors.endTime = "End time must be after start time.";

    if (form.breakDuration === "" || !Number.isFinite(breakDuration) || breakDuration < 0) {
      nextErrors.breakDuration = "Break duration must be zero or greater.";
    }
    if (form.gracePeriod === "" || !Number.isFinite(gracePeriod) || gracePeriod < 0) {
      nextErrors.gracePeriod = "Grace period must be zero or greater.";
    }
    if (form.workingHours === "" || !Number.isFinite(workingHours) || workingHours <= 0) {
      nextErrors.workingHours = "Working hours must be greater than zero.";
    } else if (start !== null && end !== null && workingHours > (end - start - Math.max(0, breakDuration)) / 60) {
      nextErrors.workingHours = "Working hours cannot exceed shift duration after breaks.";
    }

    const duplicateCode = (store.shifts || []).find(
      (shift) => shift.id !== editingId && shift.code.toLowerCase() === form.code.trim().toLowerCase()
    );
    if (duplicateCode) nextErrors.code = "A shift with this code already exists.";
    return nextErrors;
  }

  async function handleSubmit() {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error({ title: "Cannot save shift", message: "Please review the highlighted fields." });
      return;
    }

    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const payload = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      breakDuration: Number(form.breakDuration),
      gracePeriod: Number(form.gracePeriod),
      workingHours: Number(form.workingHours),
    };
    if (editingId) {
      store.updateShift(editingId, payload);
      toast.success({ title: "Shift updated", message: `${payload.name} has been updated.` });
    } else {
      store.addShift(payload);
      toast.success({ title: "Shift created", message: `${payload.name} has been added.` });
    }
    setSaving(false);
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function confirmStatusChange() {
    if (!statusTarget) return;
    store.toggleShiftStatus(statusTarget.id);
    toast.success({
      title: "Shift status updated",
      message: `${statusTarget.name} is now ${statusTarget.status === "active" ? "inactive" : "active"}.`,
    });
    setStatusTarget(null);
  }

  const hasFilters = Boolean(search || statusFilter);

  return (
    <main className="pp-page">
      <PageHeader
        eyebrow="SHIFTS"
        title="Shifts"
        description="Manage working shifts, timings, breaks and attendance rules."
        action={<Button variant="primary" icon={Plus} onClick={openCreate}>Add Shift</Button>}
      />

      <div className="pp-toolbar">
        <div className="pp-toolbar__field pp-toolbar__field--search">
          <Input label="Search" search clearable value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shift code, name or remarks..." />
        </div>
        <div className="pp-toolbar__field">
          <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} clearable />
        </div>
        <div className="pp-toolbar__actions">
          <Button variant="ghost" icon={X} onClick={() => { setSearch(""); setStatusFilter(""); }} disabled={!hasFilters}>Clear</Button>
        </div>
        <div className="pp-toolbar__meta">
          <span><span className="pp-toolbar__count">{filtered.length}</span> shifts</span>
          <span>{(store.shifts || []).length} total records</span>
        </div>
      </div>

      <section className="pp-panel">
        <div className="pp-panel__head"><h2 className="pp-panel__title">Shift Register</h2></div>
        {filtered.length === 0 ? (
          <div className="pp-empty">
            <EmptyState
              icon={Clock3}
              title={(store.shifts || []).length ? "No shifts match your filters" : "No shifts configured"}
              description={(store.shifts || []).length ? "Adjust your search or status filter." : "Shifts will appear here once configured."}
              action={!store.shifts.length ? <Button variant="primary" icon={Plus} onClick={openCreate}>Add Shift</Button> : null}
            />
          </div>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr>
                <th>Shift Code</th><th>Shift Name</th><th>Start Time</th><th>End Time</th>
                <th>Break Duration</th><th>Grace Period</th><th>Working Hours</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((shift) => (
                  <tr key={shift.id}>
                    <td className="shift-code">{shift.code || "—"}</td>
                    <td className="pp-table__strong">{shift.name || "—"}</td>
                    <td>{shift.startTime || "—"}</td>
                    <td>{shift.endTime || "—"}</td>
                    <td>{shift.breakDuration ?? "—"} min</td>
                    <td>{shift.gracePeriod ?? "—"} min</td>
                    <td>{shift.workingHours ?? "—"} h</td>
                    <td><span className={`shift-status shift-status--${shift.status}`}>{shift.status === "active" ? "Active" : "Inactive"}</span></td>
                    <td><div className="pp-actions">
                      <button type="button" className="pp-action-btn" onClick={() => setViewShift(shift)}>View</button>
                      <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => openEdit(shift)}>Edit</button>
                      <button type="button" className="pp-action-btn" onClick={() => setStatusTarget(shift)}>
                        {shift.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) { setFormOpen(false); setForm(EMPTY_FORM); setErrors({}); } }}
        title={editingId ? "Edit Shift" : "Add Shift"}
        description="Set the shift schedule and attendance rules."
        size="large"
        loading={saving}
        footer={<div className="pp-modal-footer">
          <Button variant="ghost" disabled={saving} onClick={() => { setFormOpen(false); setForm(EMPTY_FORM); setErrors({}); }}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>{editingId ? "Save Changes" : "Save Shift"}</Button>
        </div>}
      >
        <div className="pp-form-grid">
          <Input label="Shift Code" required value={form.code} onChange={(event) => setField("code", event.target.value)} error={errors.code} disabled={saving} />
          <Input label="Shift Name" required value={form.name} onChange={(event) => setField("name", event.target.value)} error={errors.name} disabled={saving} />
          <Input label="Start Time" required type="time" value={form.startTime} onChange={(event) => setField("startTime", event.target.value)} error={errors.startTime} disabled={saving} />
          <Input label="End Time" required type="time" value={form.endTime} onChange={(event) => setField("endTime", event.target.value)} error={errors.endTime} disabled={saving} />
          <Input label="Break Duration (minutes)" required type="number" min="0" step="1" value={form.breakDuration} onChange={(event) => setField("breakDuration", event.target.value)} error={errors.breakDuration} disabled={saving} />
          <Input label="Grace Period (minutes)" required type="number" min="0" step="1" value={form.gracePeriod} onChange={(event) => setField("gracePeriod", event.target.value)} error={errors.gracePeriod} disabled={saving} />
          <Input label="Working Hours" required type="number" min="0.1" step="0.1" value={form.workingHours} onChange={(event) => setField("workingHours", event.target.value)} error={errors.workingHours} disabled={saving} />
          <Select label="Status" value={form.status} onChange={(value) => setField("status", value)} options={SHIFT_STATUSES} disabled={saving} />
          <div className="pp-form-field pp-form-field--full">
            <Input label="Remarks" value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} disabled={saving} />
          </div>
        </div>
      </Modal>

      <Drawer open={Boolean(viewShift)} onClose={() => setViewShift(null)} title={viewShift?.name || "Shift details"} description="Shift configuration">
        {viewShift && <div className="pp-detail-grid">
          <div className="pp-detail-item"><span className="pp-detail-item__label">Shift Code</span><span className="pp-detail-item__value">{viewShift.code || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Status</span><span className="pp-detail-item__value">{viewShift.status}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Schedule</span><span className="pp-detail-item__value">{viewShift.startTime} – {viewShift.endTime}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Break / Grace</span><span className="pp-detail-item__value">{viewShift.breakDuration} / {viewShift.gracePeriod} minutes</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Working Hours</span><span className="pp-detail-item__value">{viewShift.workingHours} hours</span></div>
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Remarks</span><span className="pp-detail-item__value">{viewShift.remarks || "—"}</span></div>
        </div>}
      </Drawer>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
        title={statusTarget?.status === "active" ? "Deactivate shift?" : "Activate shift?"}
        description={statusTarget ? `${statusTarget.name} will be marked ${statusTarget.status === "active" ? "inactive" : "active"}.` : ""}
        confirmLabel={statusTarget?.status === "active" ? "Deactivate" : "Activate"}
        variant={statusTarget?.status === "active" ? "danger" : "info"}
      />
    </main>
  );
}
