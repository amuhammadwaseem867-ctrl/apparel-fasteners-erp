"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, X } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import FileUpload from "@/components/ui/FileUpload";
import Modal from "@/components/ui/Modal";
import Drawer from "@/components/ui/Drawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { usePeoplePayrollStore } from "@/lib/usePeoplePayrollStore";
import { DEPARTMENTS, LEAVE_STATUSES, LEAVE_TYPES, getDepartmentLabel } from "@/config/people-payroll";

import "../shared.css";
import "./leave.css";

const EMPTY_FORM = {
  employeeId: "",
  employeeName: "",
  departmentId: "",
  departmentName: "",
  leaveType: "",
  fromDate: "",
  toDate: "",
  reason: "",
};

const ACTION_COPY = {
  approve: { title: "Approve leave request?", label: "Approve", variant: "success" },
  reject: { title: "Reject leave request?", label: "Reject", variant: "danger" },
  cancel: { title: "Cancel leave request?", label: "Cancel Request", variant: "warning" },
};

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function statusLabel(status) {
  return LEAVE_STATUSES.find((item) => item.value === status)?.label || status || "—";
}

export default function LeavePage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [documentFiles, setDocumentFiles] = useState([]);
  const [viewRequest, setViewRequest] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");

  const employeeOptions = useMemo(
    () => (store.employees || []).map((employee) => ({
      value: employee.employeeId || employee.id,
      label: `${employee.fullName} (${employee.employeeId || "No ID"})`,
    })),
    [store.employees]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (store.leaveRequests || []).filter((request) => {
      const matchesSearch =
        !query ||
        (request.requestId || "").toLowerCase().includes(query) ||
        (request.employeeName || "").toLowerCase().includes(query) ||
        (request.employeeId || "").toLowerCase().includes(query) ||
        (request.reason || "").toLowerCase().includes(query);
      return (
        matchesSearch &&
        (!employeeFilter || request.employeeId === employeeFilter) &&
        (!departmentFilter || request.departmentId === departmentFilter) &&
        (!typeFilter || request.leaveType === typeFilter) &&
        (!statusFilter || request.status === statusFilter) &&
        (!fromFilter || Boolean(request.toDate && request.toDate >= fromFilter)) &&
        (!toFilter || Boolean(request.fromDate && request.fromDate <= toFilter))
      );
    });
  }, [store.leaveRequests, search, employeeFilter, departmentFilter, typeFilter, statusFilter, fromFilter, toFilter]);

  const hasFilters = Boolean(search || employeeFilter || departmentFilter || typeFilter || statusFilter || fromFilter || toFilter);

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
      departmentId: employee?.departmentId || "",
      departmentName: employee ? getDepartmentLabel(employee.departmentId) : "",
    }));
    setErrors((current) => ({ ...current, employeeId: undefined }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setDocumentFiles([]);
    setErrors({});
    setFormOpen(true);
  }

  function validate() {
    const nextErrors = {};
    if (!form.employeeId) nextErrors.employeeId = "Employee is required.";
    if (!form.leaveType) nextErrors.leaveType = "Leave type is required.";
    if (!form.fromDate) nextErrors.fromDate = "Start date is required.";
    if (!form.toDate) nextErrors.toDate = "End date is required.";
    if (form.fromDate && form.toDate && form.toDate < form.fromDate) nextErrors.toDate = "End date cannot be before start date.";
    if (!form.reason.trim()) nextErrors.reason = "Please provide a reason for the leave request.";
    return nextErrors;
  }

  async function handleSubmit() {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error({ title: "Cannot submit leave request", message: "Please review the highlighted fields." });
      return;
    }
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const employee = (store.employees || []).find((item) => item.employeeId === form.employeeId || item.id === form.employeeId);
    const days = Math.floor((new Date(`${form.toDate}T00:00:00Z`) - new Date(`${form.fromDate}T00:00:00Z`)) / 86400000) + 1;
    store.addLeaveRequest({
      ...form,
      employeeName: employee?.fullName || form.employeeName,
      departmentId: employee?.departmentId || form.departmentId,
      departmentName: employee ? getDepartmentLabel(employee.departmentId) : form.departmentName,
      days,
      document: documentFiles[0]?.file
        ? { name: documentFiles[0].file.name, size: documentFiles[0].file.size, type: documentFiles[0].file.type, file: documentFiles[0].file }
        : "",
    });
    toast.success({ title: "Leave request submitted", message: `${employee?.fullName || form.employeeName}'s request is pending review.` });
    setSaving(false);
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setDocumentFiles([]);
    setErrors({});
  }

  function openAction(action, request) {
    setActionTarget({ action, request });
    setRejectionReason("");
    setRejectionError("");
  }

  function confirmAction() {
    if (!actionTarget) return;
    const { action, request } = actionTarget;
    if (action === "reject" && !rejectionReason.trim()) {
      setRejectionError("Rejection reason is required.");
      return;
    }
    if (action === "approve") {
      store.approveLeaveRequest(request.id);
    } else if (action === "reject") {
      store.rejectLeaveRequest(request.id);
      store.updateLeaveRequest(request.id, { rejectionReason: rejectionReason.trim() });
    } else {
      store.cancelLeaveRequest(request.id);
    }
    const result = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
    toast.success({ title: `Leave request ${result}`, message: `${request.requestId || request.employeeName}'s request was ${result}.` });
    setActionTarget(null);
    setRejectionReason("");
  }

  function clearFilters() {
    setSearch("");
    setEmployeeFilter("");
    setDepartmentFilter("");
    setTypeFilter("");
    setStatusFilter("");
    setFromFilter("");
    setToFilter("");
  }

  const actionCopy = actionTarget ? ACTION_COPY[actionTarget.action] : null;

  return (
    <main className="pp-page">
      <PageHeader
        eyebrow="LEAVE MANAGEMENT"
        title="Leave Management"
        description="Manage employee leave requests, approvals and leave history."
        action={<Button variant="primary" icon={Plus} onClick={openCreate}>Request Leave</Button>}
      />

      <div className="pp-toolbar pp-toolbar--stacked">
        <div className="pp-toolbar__field pp-toolbar__field--search">
          <Input label="Search" search clearable value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, request or reason..." />
        </div>
        <div className="pp-toolbar__field">
          <Select label="Employee" value={employeeFilter} onChange={setEmployeeFilter} options={[{ value: "", label: "All Employees" }, ...employeeOptions]} searchable clearable />
        </div>
        <div className="pp-toolbar__field">
          <Select label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={[{ value: "", label: "All Departments" }, ...DEPARTMENTS]} searchable clearable />
        </div>
        <div className="pp-toolbar__field">
          <Select label="Leave Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: "", label: "All Types" }, ...LEAVE_TYPES]} clearable />
        </div>
        <div className="pp-toolbar__field">
          <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, ...LEAVE_STATUSES]} clearable />
        </div>
        <div className="pp-toolbar__field"><Input label="From" type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} /></div>
        <div className="pp-toolbar__field"><Input label="To" type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} /></div>
        <div className="pp-toolbar__actions">
          <Button variant="ghost" icon={X} onClick={clearFilters} disabled={!hasFilters}>Clear Filters</Button>
        </div>
        <div className="pp-toolbar__meta"><span><span className="pp-toolbar__count">{filtered.length}</span> leave request{filtered.length === 1 ? "" : "s"}</span><span>{store.leaveRequests.length} total records</span></div>
      </div>

      <section className="pp-panel">
        <div className="pp-panel__head"><h2 className="pp-panel__title">Leave Requests</h2></div>
        {filtered.length === 0 ? (
          <div className="pp-empty">
            <EmptyState
              icon={CalendarDays}
              title="No leave requests found"
              description={store.leaveRequests.length ? "No requests match the selected filters." : "Leave requests will appear here once connected or submitted."}
              action={!store.leaveRequests.length ? <Button variant="primary" icon={Plus} onClick={openCreate}>Request Leave</Button> : null}
            />
          </div>
        ) : (
          <div className="pp-table-wrap"><table className="pp-table">
            <thead><tr><th>Request ID</th><th>Employee</th><th>Department</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((request) => (
              <tr key={request.id}>
                <td className="pp-table__strong">{request.requestId || "—"}</td>
                <td>{request.employeeName || request.employeeId || "—"}</td>
                <td>{request.departmentName || getDepartmentLabel(request.departmentId)}</td>
                <td>{LEAVE_TYPES.find((type) => type.value === request.leaveType)?.label || request.leaveType || "—"}</td>
                <td>{formatDate(request.fromDate)}</td><td>{formatDate(request.toDate)}</td><td>{request.days || "—"}</td>
                <td className="pp-table__muted">{request.reason || "—"}</td>
                <td><span className={`lv-status lv-status--${request.status}`}>{statusLabel(request.status)}</span></td>
                <td><div className="pp-actions">
                  <button type="button" className="pp-action-btn" onClick={() => setViewRequest(request)}>View</button>
                  {request.status === "pending" && <>
                    <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => openAction("approve", request)}>Approve</button>
                    <button type="button" className="pp-action-btn pp-action-btn--danger" onClick={() => openAction("reject", request)}>Reject</button>
                  </>}
                  {(request.status === "pending" || request.status === "approved") && <button type="button" className="pp-action-btn" onClick={() => openAction("cancel", request)}>Cancel</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) { setFormOpen(false); setForm(EMPTY_FORM); setDocumentFiles([]); setErrors({}); } }}
        title="Request Leave"
        description="Submit a leave request for review."
        size="large"
        loading={saving}
        footer={<div className="pp-modal-footer">
          <Button variant="ghost" disabled={saving} onClick={() => { setFormOpen(false); setForm(EMPTY_FORM); setDocumentFiles([]); setErrors({}); }}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>Submit Request</Button>
        </div>}
      >
        <div className="pp-form-grid">
          <Select label="Employee" required value={form.employeeId} onChange={handleEmployeeChange} options={employeeOptions} searchable clearable error={errors.employeeId} />
          <Select label="Leave Type" required value={form.leaveType} onChange={(value) => setField("leaveType", value)} options={LEAVE_TYPES} error={errors.leaveType} />
          <Input label="From Date" required type="date" value={form.fromDate} onChange={(event) => setField("fromDate", event.target.value)} error={errors.fromDate} />
          <Input label="To Date" required type="date" value={form.toDate} onChange={(event) => setField("toDate", event.target.value)} error={errors.toDate} />
          <div className="pp-form-field pp-form-field--full">
            <Input label="Reason" required value={form.reason} onChange={(event) => setField("reason", event.target.value)} error={errors.reason} />
          </div>
          <div className="pp-form-field pp-form-field--full">
            <FileUpload
              label="Supporting Document (optional)"
              description="Attach one supporting PDF, document, spreadsheet or image."
              accept={[".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".webp"]}
              maxFiles={1}
              multiple={false}
              value={documentFiles}
              onChange={setDocumentFiles}
              disabled={saving}
            />
          </div>
        </div>
      </Modal>

      <Drawer open={Boolean(viewRequest)} onClose={() => setViewRequest(null)} title={viewRequest?.requestId || "Leave request"} description="Leave request details">
        {viewRequest && <div className="pp-detail-grid">
          <div className="pp-detail-item"><span className="pp-detail-item__label">Employee</span><span className="pp-detail-item__value">{viewRequest.employeeName || viewRequest.employeeId || "—"}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Department</span><span className="pp-detail-item__value">{viewRequest.departmentName || getDepartmentLabel(viewRequest.departmentId)}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Leave Type</span><span className="pp-detail-item__value">{LEAVE_TYPES.find((type) => type.value === viewRequest.leaveType)?.label || viewRequest.leaveType}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Date Range</span><span className="pp-detail-item__value">{formatDate(viewRequest.fromDate)} – {formatDate(viewRequest.toDate)}</span></div>
          <div className="pp-detail-item"><span className="pp-detail-item__label">Days / Status</span><span className="pp-detail-item__value">{viewRequest.days || "—"} / {statusLabel(viewRequest.status)}</span></div>
          <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Reason</span><span className="pp-detail-item__value">{viewRequest.reason || "—"}</span></div>
          {viewRequest.rejectionReason && <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Rejection Reason</span><span className="pp-detail-item__value">{viewRequest.rejectionReason}</span></div>}
          {viewRequest.document && <div className="pp-detail-item pp-detail-item--full"><span className="pp-detail-item__label">Supporting Document</span><span className="pp-detail-item__value">{viewRequest.document.name || viewRequest.document}</span></div>}
        </div>}
      </Drawer>

      <ConfirmDialog
        open={Boolean(actionTarget)}
        onClose={() => { setActionTarget(null); setRejectionReason(""); setRejectionError(""); }}
        onConfirm={confirmAction}
        title={actionCopy?.title}
        description={actionTarget ? `${actionTarget.request.requestId || actionTarget.request.employeeName}'s request will be ${actionTarget.action === "approve" ? "approved" : actionTarget.action === "reject" ? "rejected" : "cancelled"}.` : ""}
        confirmLabel={actionCopy?.label}
        variant={actionCopy?.variant}
      >
        {actionTarget?.action === "reject" && (
          <div className="pp-rejection-field">
            <Input label="Rejection Reason" required value={rejectionReason} onChange={(event) => { setRejectionReason(event.target.value); setRejectionError(""); }} error={rejectionError} />
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}
