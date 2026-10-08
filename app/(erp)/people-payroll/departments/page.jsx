"use client";

import { useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search, X } from "lucide-react";

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
import { DEPARTMENTS } from "@/config/people-payroll";

import "../shared.css";
import "./departments.css";

const EMPTY_FORM = { code: "", name: "", description: "", head: "", status: "active" };

export default function DepartmentsPage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewDept, setViewDept] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.departments.filter(
      (d) => !q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || (d.head || "").toLowerCase().includes(q)
    );
  }, [store.departments, search]);

  function clearFilters() {
    setSearch("");
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(dept) {
    setEditingId(dept.id);
    setForm({ code: dept.code, name: dept.name, description: dept.description, head: dept.head, status: dept.status });
    setErrors({});
    setFormOpen(true);
  }

  function setField(key, value) {
    setForm((c) => ({ ...c, [key]: value }));
    setErrors((c) => ({ ...c, [key]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.code.trim()) e.code = "Department code is required.";
    if (!form.name.trim()) e.name = "Department name is required.";
    const duplicate = store.departments.find(
      (d) => d.id !== editingId && (d.code.toLowerCase() === form.code.trim().toLowerCase() || d.name.toLowerCase() === form.name.trim().toLowerCase())
    );
    if (duplicate) e.code = "A department with this code or name already exists.";
    return e;
  }

  function handleSubmit() {
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      toast.error({ title: "Cannot save department", message: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    if (editingId) {
      store.updateDepartment(editingId, form);
      toast.success({ title: "Department updated", message: `${form.name} has been updated.` });
    } else {
      store.addDepartment(form);
      toast.success({ title: "Department created", message: `${form.name} has been added.` });
    }
    setSaving(false);
    setFormOpen(false);
  }

  function confirmToggle() {
    if (!toggleTarget) return;
    store.toggleDepartmentStatus(toggleTarget.id);
    toast.success({ title: "Status changed", message: `${toggleTarget.name} status updated.` });
    setToggleTarget(null);
  }

  return (
    <main className="pp-page">
      <PageHeader
        eyebrow="People & Payroll"
        title="Departments"
        description="Organize the factory into departments and manage their status."
        action={
          <div className="pp-toolbar__actions">
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Add Department
            </Button>
          </div>
        }
      />

      <div className="pp-toolbar">
        <div className="pp-toolbar__field pp-toolbar__field--search">
          <Input label="Search" search clearable value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code, name or head..." />
        </div>
        <div className="pp-toolbar__actions">
          <Button variant="ghost" icon={X} onClick={clearFilters} disabled={!search}>
            Clear Filters
          </Button>
        </div>
        <div className="pp-toolbar__meta">
          <span>
            <span className="pp-toolbar__count">{filtered.length}</span> department{filtered.length === 1 ? "" : "s"}
          </span>
          <span>{store.departments.length} total records</span>
        </div>
      </div>

      <div className="pp-panel">
        <div className="pp-panel__head">
          <h2 className="pp-panel__title">Department Directory</h2>
        </div>

        {filtered.length === 0 ? (
          <div className="pp-empty">
            <EmptyState
              icon={Building2}
              title={search ? "No departments found" : "No departments yet"}
              description={search ? "No departments match your search." : "Departments you create will appear here."}
              action={
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  Add Department
                </Button>
              }
            />
          </div>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Department Name</th>
                  <th>Description</th>
                  <th>Department Head</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dept) => (
                  <tr key={dept.id}>
                    <td className="dep-code">{dept.code}</td>
                    <td className="pp-table__strong">{dept.name}</td>
                    <td className="pp-table__muted">{dept.description || "—"}</td>
                    <td>{dept.head || "—"}</td>
                    <td>
                      <span className={`dep-status dep-status--${dept.status}`}>{dept.status === "active" ? "Active" : "Inactive"}</span>
                    </td>
                    <td>
                      <div className="pp-actions">
                        <button className="pp-action-btn" onClick={() => setViewDept(dept)}>View</button>
                        <button className="pp-action-btn pp-action-btn--primary" onClick={() => openEdit(dept)}>Edit</button>
                        <button className="pp-action-btn" onClick={() => setToggleTarget(dept)}>
                          {dept.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit Department" : "Add Department"}
        description="Departments reflect the factory structure."
        size="medium"
        loading={saving}
        footer={
          <div className="pp-modal-footer">
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>{editingId ? "Save Changes" : "Save Department"}</Button>
          </div>
        }
      >
        <div className="pp-form-grid">
          <Input label="Department Code" required value={form.code} onChange={(e) => setField("code", e.target.value)} error={errors.code} placeholder="e.g. QC" disabled={saving} />
          <Input label="Department Name" required value={form.name} onChange={(e) => setField("name", e.target.value)} error={errors.name} placeholder="Department name" disabled={saving} />
          <div className="pp-form-field--full">
            <Input label="Description" value={form.description} onChange={(e) => setField("description", e.target.value)} error={errors.description} placeholder="Short description" disabled={saving} />
          </div>
          <Input label="Department Head" value={form.head} onChange={(e) => setField("head", e.target.value)} error={errors.head} placeholder="Responsible person" disabled={saving} />
          <Select label="Status" value={form.status} onChange={(v) => setField("status", v)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} disabled={saving} />
        </div>

        <div className="pp-form-section" style={{ marginTop: 16 }}>
          <h3 className="pp-form-section__title">Factory taxonomy</h3>
          <p className="pp-form-section__hint">Select a standard department name to pre-fill, then add it.</p>
          <div className="pp-quick-grid">
            {DEPARTMENTS.map((d) => (
              <button key={d.value} type="button" className="pp-quick" onClick={() => setForm((c) => ({ ...c, code: d.value.slice(0, 3).toUpperCase(), name: d.label }))}>
                <span className="pp-quick__label">{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Drawer open={Boolean(viewDept)} onClose={() => setViewDept(null)} title={viewDept?.name || ""} eyebrow="Department" size="medium">
        {viewDept && (
          <div className="pp-detail-grid">
            <div className="pp-detail-item"><span className="pp-detail-item__label">Code</span><span className="pp-detail-item__value">{viewDept.code}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Status</span><span className="pp-detail-item__value">{viewDept.status}</span></div>
            <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Description</span><span className="pp-detail-item__value">{viewDept.description || "—"}</span></div>
            <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Head</span><span className="pp-detail-item__value">{viewDept.head || "—"}</span></div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
        title={`${toggleTarget?.status === "active" ? "Deactivate" : "Activate"} department?`}
        description={`${toggleTarget?.name || "This department"} will change status.`}
        confirmLabel={toggleTarget?.status === "active" ? "Deactivate" : "Activate"}
        variant={toggleTarget?.status === "active" ? "danger" : "success"}
      />
    </main>
  );
}

