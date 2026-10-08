"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Plus, Search, Trash2, User, Users, X } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Drawer from "@/components/ui/Drawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { usePeoplePayrollStore } from "@/lib/usePeoplePayrollStore";
import {
  DEPARTMENTS,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  getDepartmentLabel,
} from "@/config/people-payroll";

import "../shared.css";
import "./employees.css";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  employeeId: "",
  fullName: "",
  fatherName: "",
  cnic: "",
  dateOfBirth: "",
  gender: "male",
  phone: "",
  email: "",
  address: "",
  departmentId: "",
  designation: "",
  employmentType: "full-time",
  joiningDate: "",
  shiftId: "",
  status: "active",
  emergencyContact: "",
  notes: "",
};

export default function EmployeesPage() {
  const router = useRouter();
  const toast = useToast();
  const store = usePeoplePayrollStore();

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [joiningFilter, setJoiningFilter] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [viewEmployee, setViewEmployee] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const designations = useMemo(
    () => Array.from(new Set(store.employees.map((e) => e.designation).filter(Boolean))).sort(),
    [store.employees]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.employees.filter((e) => {
      const matchSearch =
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        (e.phone || "").toLowerCase().includes(q) ||
        (e.cnic || "").toLowerCase().includes(q);
      const matchDept = !departmentFilter || e.departmentId === departmentFilter;
      const matchStatus = !statusFilter || e.status === statusFilter;
      const matchDesig = !designationFilter || e.designation === designationFilter;
      const matchJoin = !joiningFilter || (e.joiningDate && e.joiningDate >= joiningFilter);
      return matchSearch && matchDept && matchStatus && matchDesig && matchJoin;
    });
  }, [store.employees, search, departmentFilter, statusFilter, designationFilter, joiningFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = Boolean(search || departmentFilter || statusFilter || designationFilter || joiningFilter);

  function clearFilters() {
    setSearch("");
    setDepartmentFilter("");
    setStatusFilter("");
    setDesignationFilter("");
    setJoiningFilter("");
    setPage(1);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(employee) {
    setEditingId(employee.id);
    setForm({
      employeeId: employee.employeeId || "",
      fullName: employee.fullName || "",
      fatherName: employee.fatherName || "",
      cnic: employee.cnic || "",
      dateOfBirth: employee.dateOfBirth || "",
      gender: employee.gender || "male",
      phone: employee.phone || "",
      email: employee.email || "",
      address: employee.address || "",
      departmentId: employee.departmentId || "",
      designation: employee.designation || "",
      employmentType: employee.employmentType || "full-time",
      joiningDate: employee.joiningDate || "",
      shiftId: employee.shiftId || "",
      status: employee.status || "active",
      emergencyContact: employee.emergencyContact || "",
      notes: employee.notes || "",
    });
    setErrors({});
    setFormOpen(true);
  }

  function setField(key, value) {
    setForm((c) => ({ ...c, [key]: value }));
    setErrors((c) => ({ ...c, [key]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.employeeId.trim()) e.employeeId = "Employee ID is required.";
    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    if (!form.departmentId) e.departmentId = "Department is required.";
    if (!form.designation.trim()) e.designation = "Designation is required.";
    if (!form.joiningDate) e.joiningDate = "Joining date is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address.";
    return e;
  }

  function handleSubmit() {
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      toast.error({ title: "Cannot save employee", message: "Please fix the highlighted fields." });
      return;
    }
    setSaving(true);
    if (editingId) {
      store.updateEmployee(editingId, form);
      toast.success({ title: "Employee updated", message: `${form.fullName} has been updated.` });
    } else {
      store.addEmployee(form);
      toast.success({ title: "Employee created", message: `${form.fullName} has been added.` });
    }
    setSaving(false);
    setFormOpen(false);
    setPage(1);
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    store.deactivateEmployee(deactivateTarget.id);
    toast.success({ title: "Employee deactivated", message: `${deactivateTarget.fullName} is now inactive.` });
    setDeactivateTarget(null);
  }


  return (
    <main className="pp-page">
      <PageHeader
        eyebrow="People & Payroll"
        title="Employees"
        description="Manage employee records, assignments and employment status."
        action={
          <div className="pp-toolbar__actions">
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Add Employee
            </Button>
          </div>
        }
      />

      <div className="pp-toolbar">
        <div className="pp-toolbar__field pp-toolbar__field--search">
          <Input
            label="Search"
            search
            clearable
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, ID, phone or CNIC..."
          />
        </div>

        <div className="pp-toolbar__field">
          <Select
            label="Department"
            value={departmentFilter}
            onChange={(v) => {
              setDepartmentFilter(v);
              setPage(1);
            }}
            options={[{ value: "", label: "All Departments" }, ...DEPARTMENTS.map((d) => ({ value: d.value, label: d.label }))]}
            searchable
            clearable
          />
        </div>

        <div className="pp-toolbar__field">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[{ value: "", label: "All Statuses" }, ...EMPLOYEE_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
            clearable
          />
        </div>

        <div className="pp-toolbar__field">
          <Select
            label="Designation"
            value={designationFilter}
            onChange={(v) => {
              setDesignationFilter(v);
              setPage(1);
            }}
            options={[{ value: "", label: "All Designations" }, ...designations.map((d) => ({ value: d, label: d }))]}
            searchable
            clearable
          />
        </div>

        <div className="pp-toolbar__field pp-toolbar__field--narrow">
          <Input
            label="Joined since"
            type="date"
            value={joiningFilter}
            onChange={(e) => {
              setJoiningFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="pp-toolbar__actions">
          <Button variant="ghost" icon={X} onClick={clearFilters} disabled={!hasFilters}>
            Clear Filters
          </Button>
        </div>

        <div className="pp-toolbar__meta">
          <span>
            <span className="pp-toolbar__count">{filtered.length}</span> employee{filtered.length === 1 ? "" : "s"} found
          </span>
          <span>{store.employees.length} total records</span>
        </div>
      </div>


      <div className="pp-panel">
        <div className="pp-panel__head">
          <h2 className="pp-panel__title">Employee Directory</h2>
        </div>

        {filtered.length === 0 ? (
          <div className="pp-empty">
            <EmptyState
              icon={Users}
              title={hasFilters ? "No employees found" : "No employees yet"}
              description={hasFilters ? "No employees match the current filters. Try clearing the filters." : "Employees you add will appear here."}
              action={
                hasFilters ? (
                  <Button variant="secondary" icon={X} onClick={clearFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button variant="primary" icon={Plus} onClick={openCreate}>
                    Add Employee
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Employment Type</th>
                    <th>Joining Date</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((employee) => (
                    <tr key={employee.id}>
                      <td className="pp-table__strong">{employee.employeeId}</td>
                      <td>
                        <div className="emp-primary">
                          <span className="emp-primary__name">{employee.fullName}</span>
                          <span className="emp-primary__id">{employee.email || "—"}</span>
                        </div>
                      </td>
                      <td>{getDepartmentLabel(employee.departmentId)}</td>
                      <td>{employee.designation || "—"}</td>
                      <td>{EMPLOYMENT_TYPES.find((t) => t.value === employee.employmentType)?.label || employee.employmentType}</td>
                      <td>{employee.joiningDate || "—"}</td>
                      <td>{employee.phone || "—"}</td>
                      <td>
                        <span className={`emp-status emp-status--${employee.status}`}>
                          {EMPLOYEE_STATUSES.find((s) => s.value === employee.status)?.label || employee.status}
                        </span>
                      </td>
                      <td>
                        <div className="pp-actions">
                          <button className="pp-action-btn" onClick={() => setViewEmployee(employee)} title="View">View</button>
                          <button className="pp-action-btn pp-action-btn--primary" onClick={() => openEdit(employee)} title="Edit">Edit</button>
                          <button
                            className="pp-action-btn"
                            onClick={() => toast.info({ title: "Documents", message: `Document management for ${employee.fullName} will be connected when backend storage is available.` })}
                            title="Documents"
                          >
                            Documents
                          </button>
                          <button
                            className="pp-action-btn pp-action-btn--danger"
                            onClick={() => setDeactivateTarget(employee)}
                            disabled={employee.status === "inactive"}
                            title="Deactivate"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--af-border)" }}>
              <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>


      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit Employee" : "Add Employee"}
        description={editingId ? "Update employee details." : "Create a new employee record."}
        size="large"
        loading={saving}
        footer={
          <div className="pp-modal-footer">
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              {editingId ? "Save Changes" : "Save Employee"}
            </Button>
          </div>
        }
      >
        <div className="pp-form-section">
          <h3 className="pp-form-section__title">Personal Details</h3>
          <p className="pp-form-section__hint">Fields marked with * are required.</p>
          <div className="pp-form-grid">
            <Input label="Employee ID" required value={form.employeeId} onChange={(e) => setField("employeeId", e.target.value)} error={errors.employeeId} placeholder="EMP-0001" disabled={saving} />
            <Input label="Full Name" required value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} error={errors.fullName} placeholder="Employee full name" disabled={saving} />
            <Input label="Father / Guardian Name" value={form.fatherName} onChange={(e) => setField("fatherName", e.target.value)} error={errors.fatherName} disabled={saving} />
            <Input label="CNIC / National ID" value={form.cnic} onChange={(e) => setField("cnic", e.target.value)} error={errors.cnic} placeholder="00000-0000000-0" disabled={saving} />
            <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} error={errors.dateOfBirth} disabled={saving} />
            <Select label="Gender" value={form.gender} onChange={(v) => setField("gender", v)} options={GENDERS.map((g) => ({ value: g.value, label: g.label }))} disabled={saving} />
          </div>
        </div>

        <div className="pp-form-section">
          <h3 className="pp-form-section__title">Contact</h3>
          <p className="pp-form-section__hint">How to reach this employee.</p>
          <div className="pp-form-grid">
            <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} error={errors.phone} placeholder="+92 300 0000000" disabled={saving} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} error={errors.email} placeholder="name@company.com" disabled={saving} />
            <div className="pp-form-field--full">
              <Input label="Address" value={form.address} onChange={(e) => setField("address", e.target.value)} error={errors.address} placeholder="Residential address" disabled={saving} />
            </div>
            <Input label="Emergency Contact" value={form.emergencyContact} onChange={(e) => setField("emergencyContact", e.target.value)} error={errors.emergencyContact} placeholder="Name and number" disabled={saving} />
          </div>
        </div>


        <div className="pp-form-section">
          <h3 className="pp-form-section__title">Employment</h3>
          <p className="pp-form-section__hint">Assignment within the organization.</p>
          <div className="pp-form-grid">
            <Select label="Department" required value={form.departmentId} onChange={(v) => setField("departmentId", v)} options={DEPARTMENTS.map((d) => ({ value: d.value, label: d.label }))} error={errors.departmentId} searchable disabled={saving} />
            <Input label="Designation" required value={form.designation} onChange={(e) => setField("designation", e.target.value)} error={errors.designation} placeholder="Job title" disabled={saving} />
            <Select label="Employment Type" value={form.employmentType} onChange={(v) => setField("employmentType", v)} options={EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} disabled={saving} />
            <Input label="Joining Date" required type="date" value={form.joiningDate} onChange={(e) => setField("joiningDate", e.target.value)} error={errors.joiningDate} disabled={saving} />
            <Select label="Status" value={form.status} onChange={(v) => setField("status", v)} options={EMPLOYEE_STATUSES.map((s) => ({ value: s.value, label: s.label }))} disabled={saving} />
            <Input label="Shift" value={form.shiftId} onChange={(e) => setField("shiftId", e.target.value)} error={errors.shiftId} placeholder="Assigned shift (optional)" disabled={saving} />
            <div className="pp-form-field--full">
              <Input label="Notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} error={errors.notes} placeholder="Additional notes" disabled={saving} />
            </div>
          </div>
        </div>
      </Modal>

      <Drawer
        open={Boolean(viewEmployee)}
        onClose={() => setViewEmployee(null)}
        title={viewEmployee?.fullName || ""}
        eyebrow="Employee Profile"
        size="medium"
      >
        {viewEmployee && (
          <div className="pp-detail-grid">
            <div className="pp-detail-item"><span className="pp-detail-item__label">Employee ID</span><span className="pp-detail-item__value">{viewEmployee.employeeId}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Status</span><span className="pp-detail-item__value">{EMPLOYEE_STATUSES.find((s) => s.value === viewEmployee.status)?.label}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Father / Guardian</span><span className="pp-detail-item__value">{viewEmployee.fatherName || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">CNIC</span><span className="pp-detail-item__value">{viewEmployee.cnic || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Date of Birth</span><span className="pp-detail-item__value">{viewEmployee.dateOfBirth || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Gender</span><span className="pp-detail-item__value">{GENDERS.find((g) => g.value === viewEmployee.gender)?.label || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Phone</span><span className="pp-detail-item__value">{viewEmployee.phone || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Email</span><span className="pp-detail-item__value">{viewEmployee.email || "—"}</span></div>
            <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Address</span><span className="pp-detail-item__value">{viewEmployee.address || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Department</span><span className="pp-detail-item__value">{getDepartmentLabel(viewEmployee.departmentId)}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Designation</span><span className="pp-detail-item__value">{viewEmployee.designation || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Employment Type</span><span className="pp-detail-item__value">{EMPLOYMENT_TYPES.find((t) => t.value === viewEmployee.employmentType)?.label || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Joining Date</span><span className="pp-detail-item__value">{viewEmployee.joiningDate || "—"}</span></div>
            <div className="pp-detail-item"><span className="pp-detail-item__label">Emergency Contact</span><span className="pp-detail-item__value">{viewEmployee.emergencyContact || "—"}</span></div>
            <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Notes</span><span className="pp-detail-item__value">{viewEmployee.notes || "—"}</span></div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate employee?"
        description={`${deactivateTarget?.fullName || "This employee"} will be marked inactive. This action can be reversed by editing the record.`}
        confirmLabel="Deactivate"
        variant="danger"
      />
    </main>
  );
}

