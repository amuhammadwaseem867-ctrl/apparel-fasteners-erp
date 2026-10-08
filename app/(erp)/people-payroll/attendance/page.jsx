"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Plus, Search, Upload, X } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import FileUpload from "@/components/ui/FileUpload";
import Modal from "@/components/ui/Modal";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { usePeoplePayrollStore } from "@/lib/usePeoplePayrollStore";
import { ATTENDANCE_STATUSES, DEPARTMENTS, getDepartmentLabel } from "@/config/people-payroll";

import "../shared.css";
import "./attendance.css";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  date: "",
  employeeId: "",
  employeeName: "",
  departmentId: "",
  departmentName: "",
  shiftId: "",
  shiftName: "",
  checkIn: "",
  checkOut: "",
  status: "present",
  overtime: "",
  remarks: "",
};

function toMinutes(value) {
  if (!value || typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizeOvertime(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [hours, minutes] = raw.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return Number.NaN;
    return hours + minutes / 60;
  }

  return Number.NaN;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatHours(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${numeric.toFixed(1)}h`;
}

function formatStatusLabel(status) {
  return ATTENDANCE_STATUSES.find((option) => option.value === status)?.label || status || "—";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  return rows;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default function AttendancePage() {
  const toast = useToast();
  const store = usePeoplePayrollStore();

  const [today, setToday] = useState("");

  useEffect(() => {
    const updateToday = () => {
      const now = new Date();
      setToday(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    };

    updateToday();
    const timer = window.setInterval(updateToday, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [mode, setMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [viewRecord, setViewRecord] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFiles, setImportFiles] = useState([]);
  const [importing, setImporting] = useState(false);

  const employeeOptions = useMemo(
    () =>
      (store.employees || []).map((employee) => ({
        value: employee.employeeId || employee.id,
        label: `${employee.fullName} (${employee.employeeId || "No ID"})`,
      })),
    [store.employees]
  );

  const departmentOptions = useMemo(
    () => [
      { value: "", label: "All Departments" },
      ...DEPARTMENTS.map((department) => ({ value: department.value, label: department.label })),
    ],
    []
  );

  const shiftOptions = useMemo(
    () =>
      (store.shifts || []).map((shift) => ({
        value: shift.id,
        label: `${shift.name || shift.code || "Shift"} (${shift.startTime} - ${shift.endTime})`,
      })),
    [store.shifts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(store.attendance || [])].filter((record) => {
      const matchDate = !date || record.date === date;
      const matchSearch =
        !q ||
        (record.employeeName || "").toLowerCase().includes(q) ||
        (record.employeeId || "").toLowerCase().includes(q) ||
        ((record.remarks || "").toLowerCase().includes(q) || (record.departmentName || "").toLowerCase().includes(q));
      const matchEmployee = !employeeFilter || record.employeeId === employeeFilter;
      const matchDept = !departmentFilter || record.departmentId === departmentFilter;
      const matchShift = !shiftFilter || record.shiftId === shiftFilter;
      const matchStatus = !statusFilter || record.status === statusFilter;
      const matchFrom = !fromDate || Boolean(record.date && record.date >= fromDate);
      const matchTo = !toDate || Boolean(record.date && record.date <= toDate);
      return matchDate && matchSearch && matchEmployee && matchDept && matchShift && matchStatus && matchFrom && matchTo;
    });
  }, [store.attendance, date, search, employeeFilter, departmentFilter, shiftFilter, statusFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasFilters = Boolean(search || employeeFilter || departmentFilter || shiftFilter || statusFilter || fromDate || toDate || date);

  const statusSummary = useMemo(() => {
    const summary = { present: 0, absent: 0, late: 0, leave: 0, overtime: 0 };
    filtered.forEach((record) => {
      if (summary[record.status] !== undefined) {
        summary[record.status] += 1;
      }
      const overtimeValue = Number(record.overtime ?? 0);
      if (Number.isFinite(overtimeValue) && overtimeValue > 0) {
        summary.overtime += overtimeValue;
      }
    });
    return summary;
  }, [filtered]);

  const hasAttendanceData = (store.attendance || []).length > 0;

  function clearFilters() {
    setDate("");
    setSearch("");
    setEmployeeFilter("");
    setDepartmentFilter("");
    setShiftFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: date || today });
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(record) {
    setMode("edit");
    setEditingId(record.id);
    setForm({
      date: record.date || "",
      employeeId: record.employeeId || "",
      employeeName: record.employeeName || "",
      departmentId: record.departmentId || "",
      departmentName: record.departmentName || "",
      shiftId: record.shiftId || "",
      shiftName: record.shiftName || "",
      checkIn: record.checkIn || "",
      checkOut: record.checkOut || "",
      status: record.status || "present",
      overtime: record.overtime ?? "",
      remarks: record.remarks || "",
    });
    setErrors({});
    setFormOpen(true);
  }

  function openCorrect(record) {
    setMode("correct");
    setEditingId(record.id);
    setForm({
      date: record.date || "",
      employeeId: record.employeeId || "",
      employeeName: record.employeeName || "",
      departmentId: record.departmentId || "",
      departmentName: record.departmentName || "",
      shiftId: record.shiftId || "",
      shiftName: record.shiftName || "",
      checkIn: record.checkIn || "",
      checkOut: record.checkOut || "",
      status: record.status || "present",
      overtime: record.overtime ?? "",
      remarks: record.remarks || "",
    });
    setErrors({});
    setFormOpen(true);
  }

  function handleEmployeeChange(value) {
    const selectedEmployee = (store.employees || []).find((employee) => employee.employeeId === value || employee.id === value);
    setForm((current) => ({
      ...current,
      employeeId: selectedEmployee ? selectedEmployee.employeeId || selectedEmployee.id : value,
      employeeName: selectedEmployee ? selectedEmployee.fullName : current.employeeName,
      departmentId: selectedEmployee ? selectedEmployee.departmentId : current.departmentId,
      departmentName: selectedEmployee ? getDepartmentLabel(selectedEmployee.departmentId) : current.departmentName,
      shiftId: selectedEmployee ? selectedEmployee.shiftId || "" : value ? current.shiftId : "",
      shiftName: selectedEmployee?.shiftId
        ? (store.shifts || []).find((shift) => shift.id === selectedEmployee.shiftId)?.name || ""
        : selectedEmployee || !value ? "" : current.shiftName,
    }));
    setErrors((current) => ({ ...current, employeeId: undefined }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.employeeId) nextErrors.employeeId = "Employee is required.";
    if (!form.date) nextErrors.date = "Date is required.";
    if ((store.shifts || []).length > 0 && !form.shiftId) nextErrors.shiftId = "Shift is required.";
    if (!form.status) nextErrors.status = "Status is required.";

    if (form.checkIn && toMinutes(form.checkIn) === null) nextErrors.checkIn = "Enter a valid check-in time.";
    if (form.checkOut && toMinutes(form.checkOut) === null) nextErrors.checkOut = "Enter a valid check-out time.";
    if (form.checkIn && form.checkOut) {
      const startMinutes = toMinutes(form.checkIn);
      const endMinutes = toMinutes(form.checkOut);
      if (startMinutes !== null && endMinutes !== null && endMinutes < startMinutes) {
        nextErrors.checkOut = "Check-out cannot be before check-in.";
      }
    }

    const overtimeValue = normalizeOvertime(form.overtime);
    if (form.overtime !== "" && form.overtime !== null && form.overtime !== undefined && !Number.isFinite(overtimeValue)) {
      nextErrors.overtime = "Overtime must be a valid number or time value.";
    }

    if (form.overtime !== "" && form.overtime !== null && form.overtime !== undefined && overtimeValue < 0) {
      nextErrors.overtime = "Overtime cannot be negative.";
    }

    const duplicate = (store.attendance || []).find(
      (record) =>
        record.id !== editingId &&
        record.employeeId === form.employeeId &&
        record.date === form.date &&
        record.shiftId === form.shiftId
    );

    if (duplicate) {
      nextErrors.date = "Attendance for this employee on this date already exists.";
    }

    return nextErrors;
  }

  async function handleSubmit() {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error({ title: "Cannot save attendance", message: "Please review the highlighted fields and try again." });
      return;
    }

    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const selectedEmployee = (store.employees || []).find((employee) => employee.employeeId === form.employeeId || employee.id === form.employeeId);
    const selectedShift = (store.shifts || []).find((shift) => shift.id === form.shiftId);

    const payload = {
      date: form.date,
      employeeId: selectedEmployee ? selectedEmployee.employeeId || selectedEmployee.id : form.employeeId,
      employeeName: selectedEmployee ? selectedEmployee.fullName : form.employeeName,
      departmentId: selectedEmployee ? selectedEmployee.departmentId : form.departmentId,
      departmentName: selectedEmployee ? getDepartmentLabel(selectedEmployee.departmentId) : form.departmentName,
      shiftId: form.shiftId,
      shiftName: selectedShift ? selectedShift.name || selectedShift.code : form.shiftName,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      workingHours:
        form.checkIn && form.checkOut
          ? (() => {
              const start = toMinutes(form.checkIn);
              const end = toMinutes(form.checkOut);
              if (start === null || end === null) return null;
              return Math.max(0, (end - start - Number(selectedShift?.breakDuration || 0)) / 60);
            })()
          : null,
      overtime: normalizeOvertime(form.overtime),
      status: form.status,
      remarks: form.remarks,
    };

    if (mode === "edit" || mode === "correct") {
      store.updateAttendance(editingId, payload);
      toast.success({ title: "Attendance updated", message: `${payload.employeeName} has been corrected.` });
    } else {
      store.addAttendance(payload);
      toast.success({ title: "Attendance recorded", message: `${payload.employeeName} has been added to attendance.` });
    }

    setSaving(false);
    setFormOpen(false);
    setErrors({});
    setForm(EMPTY_FORM);
    setPage(1);
  }

  async function handleImport() {
    if (importing) return;
    const item = importFiles[0];
    if (!item || item.status === "error") {
      toast.error({ title: "Choose a valid CSV file", message: "Select one valid attendance CSV file to import." });
      return;
    }
    setImporting(true);
    try {
      const rows = parseCsv(await item.file.text());
      if (rows.length < 2) throw new Error("The CSV must include a header and at least one attendance row.");
      const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, "").toLowerCase());
      const columnIndex = (name) => headers.indexOf(name);
      const employeeColumn = columnIndex("employeeid");
      const dateColumn = columnIndex("date");
      const shiftCodeColumn = columnIndex("shiftcode");
      const shiftIdColumn = columnIndex("shiftid");
      const statusColumn = columnIndex("status");
      if (employeeColumn < 0 || dateColumn < 0 || statusColumn < 0) {
        throw new Error("CSV headers must include employeeId, date and status.");
      }

      const importedRecords = [];
      const seenKeys = new Set(
        (store.attendance || []).map((record) => `${record.employeeId}|${record.date}|${record.shiftId || ""}`)
      );
      for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index];
        const valueAt = (header) => {
          const column = columnIndex(header);
          return column < 0 ? "" : (row[column] || "").trim();
        };
        const employeeId = (row[employeeColumn] || "").trim();
        const dateValue = (row[dateColumn] || "").trim();
        const status = (row[statusColumn] || "").trim().toLowerCase();
        const shiftValue = ((shiftCodeColumn >= 0 ? row[shiftCodeColumn] : row[shiftIdColumn]) || "").trim();
        const employee = store.employees.find((record) => record.employeeId === employeeId);
        const shift = shiftValue ? store.shifts.find((record) => record.id === shiftValue || (record.code || "").toLowerCase() === shiftValue.toLowerCase()) : null;
        const checkIn = valueAt("checkin");
        const checkOut = valueAt("checkout");
        const overtime = normalizeOvertime(valueAt("overtime"));
        const rowErrors = [];
        if (!employee) rowErrors.push(`unknown employee ${employeeId || "(blank)"}`);
        if (!isValidDate(dateValue)) rowErrors.push("invalid date");
        if (!ATTENDANCE_STATUSES.some((option) => option.value === status)) rowErrors.push("invalid status");
        if (shiftValue && !shift) rowErrors.push(`unknown shift ${shiftValue}`);
        if (store.shifts.length > 0 && !shiftValue) rowErrors.push("shift is required");
        if (checkIn && toMinutes(checkIn) === null) rowErrors.push("invalid check-in time");
        if (checkOut && toMinutes(checkOut) === null) rowErrors.push("invalid check-out time");
        if (checkIn && checkOut && toMinutes(checkOut) < toMinutes(checkIn)) rowErrors.push("check-out is before check-in");
        if (!Number.isFinite(overtime) || overtime < 0) rowErrors.push("invalid overtime");
        if (rowErrors.length) {
          throw new Error(`CSV row ${index + 1}: ${rowErrors.join(", ")}.`);
        }
        const shiftId = shift?.id || "";
        const key = `${employee.employeeId}|${dateValue}|${shiftId}`;
        if (seenKeys.has(key)) throw new Error(`CSV row ${index + 1}: duplicate attendance for ${employee.employeeId} on ${dateValue}.`);
        seenKeys.add(key);
        const shiftMinutes = checkIn && checkOut ? toMinutes(checkOut) - toMinutes(checkIn) : null;
        importedRecords.push({
          date: dateValue,
          employeeId: employee.employeeId || employee.id,
          employeeName: employee.fullName,
          departmentId: employee.departmentId || "",
          departmentName: getDepartmentLabel(employee.departmentId),
          shiftId,
          shiftName: shift?.name || shift?.code || "",
          checkIn,
          checkOut,
          workingHours: shiftMinutes === null ? null : Math.max(0, (shiftMinutes - Number(shift?.breakDuration || 0)) / 60),
          overtime,
          status,
          remarks: valueAt("remarks"),
        });
      }

      importedRecords.forEach((record) => store.addAttendance(record));
      toast.success({ title: "Attendance imported", message: `${importedRecords.length} real attendance record${importedRecords.length === 1 ? "" : "s"} imported.` });
      setImportOpen(false);
      setImportFiles([]);
      setPage(1);
    } catch (error) {
      toast.error({
        title: "Could not import attendance",
        message: error instanceof Error ? error.message : "The CSV could not be read.",
      });
    } finally {
      setImporting(false);
    }
  }

  const kpis = [
    { label: "Present", value: hasAttendanceData ? statusSummary.present : "—", tone: "present" },
    { label: "Absent", value: hasAttendanceData ? statusSummary.absent : "—", tone: "absent" },
    { label: "Late", value: hasAttendanceData ? statusSummary.late : "—", tone: "late" },
    { label: "On Leave", value: hasAttendanceData ? statusSummary.leave : "—", tone: "leave" },
    { label: "Overtime", value: hasAttendanceData ? `${statusSummary.overtime.toFixed(1)}h` : "—", tone: "overtime" },
  ];

  return (
    <main className="pp-page">
      <PageHeader
        eyebrow="ATTENDANCE"
        title="Attendance"
        description="Monitor employee attendance, working hours, shifts and overtime."
        action={
          <div className="pp-toolbar__actions">
            <Button variant="secondary" icon={Upload} onClick={() => { setImportFiles([]); setImportOpen(true); }}>
              Import Attendance
            </Button>
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              Record Attendance
            </Button>
          </div>
        }
      />

      <div className="pp-toolbar pp-toolbar--stacked">
        <div className="pp-toolbar__field pp-toolbar__field--search">
          <Input
            label="Search"
            search
            clearable
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search employee or remarks..."
          />
        </div>

        <div className="pp-toolbar__field">
          <Input label="Date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} />
        </div>

        <div className="pp-toolbar__field">
          <Select
            label="Employee"
            value={employeeFilter}
            onChange={(value) => {
              setEmployeeFilter(value);
              setPage(1);
            }}
            options={[{ value: "", label: "All Employees" }, ...employeeOptions]}
            searchable
            clearable
          />
        </div>

        <div className="pp-toolbar__field">
          <Select
            label="Department"
            value={departmentFilter}
            onChange={(value) => {
              setDepartmentFilter(value);
              setPage(1);
            }}
            options={departmentOptions}
            searchable
            clearable
          />
        </div>

        <div className="pp-toolbar__field">
          <Select
            label="Shift"
            value={shiftFilter}
            onChange={(value) => {
              setShiftFilter(value);
              setPage(1);
            }}
            options={[{ value: "", label: "All Shifts" }, ...shiftOptions]}
            searchable
            clearable
          />
        </div>

        <div className="pp-toolbar__field">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Statuses" },
              ...ATTENDANCE_STATUSES.map((status) => ({ value: status.value, label: status.label })),
            ]}
            clearable
          />
        </div>

        <div className="pp-toolbar__field">
          <Input label="From" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} />
        </div>

        <div className="pp-toolbar__field">
          <Input label="To" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} />
        </div>

        <div className="pp-toolbar__actions pp-toolbar__actions--compact">
          <Button variant="secondary" icon={Search} onClick={() => setPage(1)}>
            Apply Filters
          </Button>
          <Button variant="ghost" icon={X} onClick={clearFilters} disabled={!hasFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="pp-kpi-grid">
        {kpis.map((item) => (
          <div key={item.label} className={`pp-kpi-card pp-kpi-card--${item.tone}`}>
            <span className="pp-kpi-card__label">{item.label}</span>
            <strong className="pp-kpi-card__value">{item.value}</strong>
          </div>
        ))}
      </div>

      <section className="pp-panel">
        <div className="pp-panel__head">
          <h2 className="pp-panel__title">Attendance Register</h2>
          <span className="pp-panel__meta">{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="pp-empty">
            <EmptyState
              icon={CalendarCheck}
              title={hasAttendanceData ? "No attendance records match your filters" : "No attendance records"}
              description={
                hasAttendanceData
                  ? "Try adjusting your search or filter values."
                  : "Attendance records will appear here once attendance data is connected."
              }
              action={
                !hasAttendanceData ? (
                  <Button variant="primary" icon={Plus} onClick={openCreate}>
                    Record Attendance
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee ID</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Shift</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Working Hours</th>
                    <th>Overtime</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.date)}</td>
                      <td>{record.employeeId || "—"}</td>
                      <td className="pp-table__strong">{record.employeeName || "—"}</td>
                      <td>{record.departmentName || getDepartmentLabel(record.departmentId) || "—"}</td>
                      <td>{record.shiftName || "—"}</td>
                      <td>{record.checkIn || "—"}</td>
                      <td>{record.checkOut || "—"}</td>
                      <td>{formatHours(record.workingHours)}</td>
                      <td>{formatHours(record.overtime)}</td>
                      <td>
                        <span className={`att-status att-status--${record.status || "present"}`}>
                          {formatStatusLabel(record.status)}
                        </span>
                      </td>
                      <td><div className="pp-actions">
                        <button type="button" className="pp-action-btn" onClick={() => setViewRecord(record)}>View</button>
                        <button type="button" className="pp-action-btn pp-action-btn--primary" onClick={() => openEdit(record)}>Edit</button>
                        <button type="button" className="pp-action-btn" onClick={() => openCorrect(record)}>Correct Attendance</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
              showSummary
            />
          </>
        )}
      </section>

      <Modal
        open={importOpen}
        onClose={() => { if (!importing) { setImportOpen(false); setImportFiles([]); } }}
        title="Import Attendance"
        description="Import actual attendance rows from a CSV file. No records are created unless every row validates."
        size="medium"
        loading={importing}
        footer={<div className="pp-modal-footer">
          <Button variant="ghost" disabled={importing} onClick={() => { setImportOpen(false); setImportFiles([]); }}>Cancel</Button>
          <Button variant="primary" loading={importing} onClick={handleImport}>Import Records</Button>
        </div>}
      >
        <FileUpload
          label="Attendance CSV"
          description="Required headers: employeeId, date, status. Optional: shiftCode or shiftId, checkIn, checkOut, overtime, remarks."
          accept={[".csv"]}
          maxFiles={1}
          multiple={false}
          value={importFiles}
          onChange={setImportFiles}
          disabled={importing}
        />
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) {
            setFormOpen(false);
            setErrors({});
            setForm(EMPTY_FORM);
          }
        }}
        title={mode === "correct" ? "Correct Attendance" : editingId ? "Edit Attendance" : "Record Attendance"}
        description="Capture attendance details and keep records accurate."
        size="large"
        loading={saving}
        footer={
          <div className="pp-modal-footer">
            <Button variant="ghost" onClick={() => { setFormOpen(false); setErrors({}); setForm(EMPTY_FORM); }} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              {mode === "correct" ? "Save Correction" : editingId ? "Save Changes" : "Save Attendance"}
            </Button>
          </div>
        }
      >
        <div className="pp-form-grid">
          <div className="pp-form-field">
            <Select
              label="Employee"
              required
              value={form.employeeId}
              onChange={handleEmployeeChange}
              options={employeeOptions}
              searchable
              clearable
              error={errors.employeeId}
            />
          </div>

          <div className="pp-form-field">
            <Input label="Date" required type="date" value={form.date} onChange={(event) => setField("date", event.target.value)} error={errors.date} />
          </div>

          <div className="pp-form-field">
            <Select
              label="Shift"
              required
              value={form.shiftId}
              onChange={(value) => {
                const selectedShift = (store.shifts || []).find((shift) => shift.id === value);
                setForm((current) => ({
                  ...current,
                  shiftId: value,
                  shiftName: selectedShift ? selectedShift.name || selectedShift.code : "",
                }));
                setErrors((current) => ({ ...current, shiftId: undefined }));
              }}
              options={[{ value: "", label: "Select shift" }, ...shiftOptions]}
              searchable
              clearable
              error={errors.shiftId}
            />
          </div>

          <div className="pp-form-field">
            <Select
              label="Status"
              required
              value={form.status}
              onChange={(value) => setField("status", value)}
              options={ATTENDANCE_STATUSES.map((status) => ({ value: status.value, label: status.label }))}
              error={errors.status}
            />
          </div>

          <div className="pp-form-field">
            <Input label="Check In" type="time" value={form.checkIn} onChange={(event) => setField("checkIn", event.target.value)} />
          </div>

          <div className="pp-form-field">
            <Input label="Check Out" type="time" value={form.checkOut} onChange={(event) => setField("checkOut", event.target.value)} error={errors.checkOut} />
          </div>

          <div className="pp-form-field">
            <Input label="Overtime" type="text" value={form.overtime} onChange={(event) => setField("overtime", event.target.value)} placeholder="e.g. 1.5 or 01:30" error={errors.overtime} />
          </div>

          <div className="pp-form-field pp-form-field--full">
            <Input label="Remarks" type="text" value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} placeholder="Optional notes or attendance remarks" />
          </div>
        </div>
      </Modal>

      <Drawer
        open={Boolean(viewRecord)}
        onClose={() => setViewRecord(null)}
        title={viewRecord ? viewRecord.employeeName || viewRecord.employeeId : "Attendance record"}
        description="Attendance details"
        side="right"
        size="medium"
      >
        {viewRecord && (
          <div className="pp-detail-grid">
            <div>
              <span className="pp-detail-label">Date</span>
              <strong>{formatDate(viewRecord.date)}</strong>
            </div>
            <div>
              <span className="pp-detail-label">Employee ID</span>
              <strong>{viewRecord.employeeId || "—"}</strong>
            </div>
            <div>
              <span className="pp-detail-label">Department</span>
              <strong>{viewRecord.departmentName || getDepartmentLabel(viewRecord.departmentId) || "—"}</strong>
            </div>
            <div>
              <span className="pp-detail-label">Shift</span>
              <strong>{viewRecord.shiftName || "—"}</strong>
            </div>
            <div>
              <span className="pp-detail-label">Check In</span>
              <strong>{viewRecord.checkIn || "—"}</strong>
            </div>
            <div>
              <span className="pp-detail-label">Check Out</span>
              <strong>{viewRecord.checkOut || "—"}</strong>
            </div>
            <div>
              <span className="pp-detail-label">Working Hours</span>
              <strong>{formatHours(viewRecord.workingHours)}</strong>
            </div>
            <div>
              <span className="pp-detail-label">Overtime</span>
              <strong>{formatHours(viewRecord.overtime)}</strong>
            </div>
            <div className="pp-form-field--full">
              <span className="pp-detail-label">Status</span>
              <strong>
                <span className={`att-status att-status--${viewRecord.status || "present"}`}>
                  {formatStatusLabel(viewRecord.status)}
                </span>
              </strong>
            </div>
            <div className="pp-form-field--full">
              <span className="pp-detail-label">Remarks</span>
              <strong>{viewRecord.remarks || "—"}</strong>
            </div>
          </div>
        )}
      </Drawer>
    </main>
  );
}
