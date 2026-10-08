"use client";

/**
 * usePeoplePayrollStore — frontend state store for the People & Payroll module.
 *
 * In-memory CRUD, derived KPIs, workflow and payroll helpers used by the
 * People & Payroll list, detail, form and report screens until the backend
 * API is connected. Store methods are pure UI state operations only.
 */

import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";

import { PAYROLL_STATUSES } from "@/config/people-payroll";

const PeoplePayrollStoreContext = createContext(null);

function uid(prefix = "pp") {
  return prefix + "-" + Date.now() + "-" + (Math.random().toString(36).slice(2, 8));
}

function nowIso() {
  return new Date().toISOString();
}

function optionalAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function usePeoplePayrollStoreState() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [todayKey, setTodayKey] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [payrollEntries, setPayrollEntries] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [advancesLoans, setAdvancesLoans] = useState([]);
  const [deductions, setDeductions] = useState([]);

  useEffect(() => {
    const updateTodayKey = () => {
      const now = new Date();
      const key = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      setTodayKey(key);
    };

    updateTodayKey();

    const timer = window.setInterval(updateTodayKey, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  /* ============================== EMPLOYEES ============================== */

  const addEmployee = useCallback((data) => {
    const employee = {
      id: uid("emp"),
      employeeId: data.employeeId || "EMP-" + String(Date.now()).slice(-6),
      fullName: data.fullName || "",
      fatherName: data.fatherName || "",
      cnic: data.cnic || "",
      dateOfBirth: data.dateOfBirth || "",
      gender: data.gender || "male",
      phone: data.phone || "",
      email: data.email || "",
      address: data.address || "",
      departmentId: data.departmentId || "",
      designation: data.designation || "",
      employmentType: data.employmentType || "full-time",
      joiningDate: data.joiningDate || "",
      shiftId: data.shiftId || "",
      status: data.status || "active",
      emergencyContact: data.emergencyContact || "",
      notes: data.notes || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setEmployees((current) => [employee, ...current]);
    return employee;
  }, []);

  const updateEmployee = useCallback((id, data) => {
    setEmployees((current) =>
      current.map((employee) => (employee.id === id ? { ...employee, ...data, updatedAt: nowIso() } : employee))
    );
  }, []);

  const deactivateEmployee = useCallback((id) => {
    setEmployees((current) =>
      current.map((employee) => (employee.id === id ? { ...employee, status: "inactive", updatedAt: nowIso() } : employee))
    );
  }, []);

  const getEmployee = useCallback(
    (id) => employees.find((employee) => employee.id === id) || null,
    [employees]
  );

  /* ============================ DEPARTMENTS ============================ */

  const addDepartment = useCallback((data) => {
    const department = {
      id: uid("dept"),
      code: data.code || "",
      name: data.name || "",
      description: data.description || "",
      head: data.head || "",
      status: data.status || "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setDepartments((current) => [department, ...current]);
    return department;
  }, []);

  const updateDepartment = useCallback((id, data) => {
    setDepartments((current) =>
      current.map((department) => (department.id === id ? { ...department, ...data, updatedAt: nowIso() } : department))
    );
  }, []);

  const toggleDepartmentStatus = useCallback((id) => {
    setDepartments((current) =>
      current.map((department) =>
        department.id === id ? { ...department, status: department.status === "active" ? "inactive" : "active", updatedAt: nowIso() } : department
      )
    );
  }, []);

  /* ============================== SHIFTS ============================== */

  const addShift = useCallback((data) => {
    const shift = {
      id: uid("shift"),
      code: data.code || "",
      name: data.name || "",
      startTime: data.startTime || "08:00",
      endTime: data.endTime || "17:00",
      breakDuration: Number(data.breakDuration) || 0,
      gracePeriod: Number(data.gracePeriod) || 0,
      workingHours: Number(data.workingHours) || 8,
      status: data.status || "active",
      remarks: data.remarks || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setShifts((current) => [shift, ...current]);
    return shift;
  }, []);

  const updateShift = useCallback((id, data) => {
    setShifts((current) =>
      current.map((shift) => (shift.id === id ? { ...shift, ...data, updatedAt: nowIso() } : shift))
    );
  }, []);

  const toggleShiftStatus = useCallback((id) => {
    setShifts((current) =>
      current.map((shift) =>
        shift.id === id ? { ...shift, status: shift.status === "active" ? "inactive" : "active", updatedAt: nowIso() } : shift
      )
    );
  }, []);

  const getShift = useCallback(
    (id) => shifts.find((shift) => shift.id === id) || null,
    [shifts]
  );

  /* ============================= ATTENDANCE ============================= */

  const addAttendance = useCallback((data) => {
    const record = {
      id: uid("att"),
      date: data.date || "",
      employeeId: data.employeeId || "",
      employeeName: data.employeeName || "",
      departmentId: data.departmentId || "",
      departmentName: data.departmentName || "",
      shiftId: data.shiftId || "",
      shiftName: data.shiftName || "",
      checkIn: data.checkIn || "",
      checkOut: data.checkOut || "",
      workingHours: data.workingHours ?? null,
      overtime: data.overtime ?? 0,
      status: data.status || "present",
      remarks: data.remarks || "",
      createdAt: nowIso(),
    };
    setAttendance((current) => [record, ...current]);
    return record;
  }, []);

  const updateAttendance = useCallback((id, data) => {
    setAttendance((current) =>
      current.map((record) => (record.id === id ? { ...record, ...data, updatedAt: nowIso() } : record))
    );
  }, []);

  const deleteAttendance = useCallback((id) => {
    setAttendance((current) => current.filter((record) => record.id !== id));
  }, []);

  /* ============================ LEAVE REQUESTS ============================ */


  const addLeaveRequest = useCallback((data) => {
    const request = {
      id: uid("lv"),
      requestId: "LV-" + String(Date.now()).slice(-6),
      employeeId: data.employeeId || "",
      employeeName: data.employeeName || "",
      departmentId: data.departmentId || "",
      departmentName: data.departmentName || "",
      leaveType: data.leaveType || "annual",
      fromDate: data.fromDate || "",
      toDate: data.toDate || "",
      days: Number(data.days) || 0,
      reason: data.reason || "",
      document: data.document || "",
      status: data.status || "pending",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setLeaveRequests((current) => [request, ...current]);
    return request;
  }, []);

  const updateLeaveRequest = useCallback((id, data) => {
    setLeaveRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, ...data, updatedAt: nowIso() } : request))
    );
  }, []);

  const approveLeaveRequest = useCallback((id) => {
    setLeaveRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status: "approved", updatedAt: nowIso() } : request))
    );
  }, []);

  const rejectLeaveRequest = useCallback((id) => {
    setLeaveRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status: "rejected", updatedAt: nowIso() } : request))
    );
  }, []);

  const cancelLeaveRequest = useCallback((id) => {
    setLeaveRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status: "cancelled", updatedAt: nowIso() } : request))
    );
  }, []);

  /* ============================ PAYROLL PERIOD ============================ */

  const addPayrollPeriod = useCallback((data) => {
    const period = {
      id: uid("pp"),
      periodName: data.periodName || "",
      startDate: data.startDate || "",
      endDate: data.endDate || "",
      paymentDate: data.paymentDate || "",
      status: data.status || "draft",
      notes: data.notes || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setPayrollPeriods((current) => [period, ...current]);
    return period;
  }, []);

  const updatePayrollPeriod = useCallback((id, data) => {
    setPayrollPeriods((current) =>
      current.map((period) => (period.id === id ? { ...period, ...data, updatedAt: nowIso() } : period))
    );
  }, []);

  const closePayrollPeriod = useCallback((id) => {
    setPayrollPeriods((current) =>
      current.map((period) => (period.id === id ? { ...period, status: "closed", updatedAt: nowIso() } : period))
    );
  }, []);

  const getPayrollPeriod = useCallback(
    (id) => payrollPeriods.find((period) => period.id === id) || null,
    [payrollPeriods]
  );

  /* ============================ PAYROLL ENTRIES ============================ */

  const addPayrollEntry = useCallback((data) => {
    const entry = {
      id: uid("pe"),
      payrollPeriodId: data.payrollPeriodId || "",
      employeeId: data.employeeId || "",
      employeeName: data.employeeName || "",
      departmentId: data.departmentId || "",
      departmentName: data.departmentName || "",
      basicSalary: optionalAmount(data.basicSalary),
      allowances: optionalAmount(data.allowances),
      overtime: optionalAmount(data.overtime),
      deductions: optionalAmount(data.deductions),
      grossSalary: optionalAmount(data.grossSalary),
      netSalary: optionalAmount(data.netSalary),
      status: data.status || "draft",
      payslipUrl: data.payslipUrl || "",
      createdAt: nowIso(),
    };
    setPayrollEntries((current) => [entry, ...current]);
    return entry;
  }, []);

  const updatePayrollEntry = useCallback((id, data) => {
    setPayrollEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...data, updatedAt: nowIso() } : entry))
    );
  }, []);

  const computePayrollEntry = useCallback((employee) => {
    const basicSalary = optionalAmount(employee.basicSalary);
    const allowances = optionalAmount(employee.allowances);
    const overtime = optionalAmount(employee.overtime);
    const deductions = optionalAmount(employee.deductions);
    const grossSalary =
      basicSalary !== null && allowances !== null && overtime !== null
        ? basicSalary + allowances + overtime
        : null;
    return {
      id: uid("pe"),
      employeeId: employee.id,
      employeeName: employee.fullName,
      departmentId: employee.departmentId,
      departmentName: employee.departmentName,
      basicSalary,
      allowances,
      overtime,
      deductions,
      grossSalary,
      netSalary: grossSalary !== null && deductions !== null ? grossSalary - deductions : null,
      status: "draft",
      payslipUrl: "",
    };
  }, []);

  /* ============================ SALARY STRUCTURE ============================ */


  const addSalaryStructure = useCallback((data) => {
    const structure = {
      id: uid("ss"),
      name: data.name || "",
      employeeOrGroup: data.employeeOrGroup || "",
      basicSalary: Number(data.basicSalary) || 0,
      housingAllowance: optionalAmount(data.housingAllowance),
      transportAllowance: optionalAmount(data.transportAllowance),
      medicalAllowance: optionalAmount(data.medicalAllowance),
      otherAllowances: optionalAmount(data.otherAllowances),
      overtimeRule: data.overtimeRule || "",
      deductionRules: data.deductionRules || "",
      effectiveFrom: data.effectiveFrom || "",
      effectiveTo: data.effectiveTo || "",
      status: data.status || "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setSalaryStructures((current) => [structure, ...current]);
    return structure;
  }, []);

  const updateSalaryStructure = useCallback((id, data) => {
    setSalaryStructures((current) =>
      current.map((structure) => (structure.id === id ? { ...structure, ...data, updatedAt: nowIso() } : structure))
    );
  }, []);

  const toggleSalaryStructureStatus = useCallback((id) => {
    setSalaryStructures((current) =>
      current.map((structure) =>
        structure.id === id ? { ...structure, status: structure.status === "active" ? "inactive" : "active", updatedAt: nowIso() } : structure
      )
    );
  }, []);

  /* =========================== ADVANCES & LOANS =========================== */

  const addAdvanceLoan = useCallback((data) => {
    const record = {
      id: uid("al"),
      employeeId: data.employeeId || "",
      employeeName: data.employeeName || "",
      type: data.type || "salary-advance",
      requestDate: data.requestDate || "",
      amount: Number(data.amount) || 0,
      installmentAmount: Number(data.installmentAmount) || 0,
      numberOfInstallments: Number(data.numberOfInstallments) || 0,
      startDate: data.startDate || "",
      outstandingBalance: Number(data.outstandingBalance) || 0,
      status: data.status || "requested",
      remarks: data.remarks || "",
      recoveryHistory: data.recoveryHistory || [],
      createdAt: nowIso(),
    };
    setAdvancesLoans((current) => [record, ...current]);
    return record;
  }, []);

  const updateAdvanceLoan = useCallback((id, data) => {
    setAdvancesLoans((current) =>
      current.map((record) => (record.id === id ? { ...record, ...data, updatedAt: nowIso() } : record))
    );
  }, []);

  const toggleAdvanceLoanStatus = useCallback((id) => {
    setAdvancesLoans((current) =>
      current.map((record) => {
        if (record.id !== id) return record;
        let next = record.status;
        if (record.status === "requested") next = "approved";
        else if (record.status === "approved") next = "active";
        else if (record.status === "active" && record.outstandingBalance > 0) next = "partially-recovered";
        else if (record.status === "partially-recovered") next = "fully-recovered";
        else if (record.status === "fully-recovered") next = "active";
        return { ...record, status: next, updatedAt: nowIso() };
      })
    );
  }, []);

  const recordRecovery = useCallback((id, amount, recoveryDetails = {}) => {
    setAdvancesLoans((current) =>
      current.map((record) => {
        if (record.id !== id) return record;
        const remaining = Math.max(0, (record.outstandingBalance || 0) - Number(amount));
        const nextStatus = remaining <= 0 ? "fully-recovered" : "partially-recovered";
        return {
          ...record,
          outstandingBalance: remaining,
          status: nextStatus,
          recoveryHistory: [
            ...(record.recoveryHistory || []),
            { ...recoveryDetails, amount: Number(amount), createdAt: nowIso() },
          ],
          updatedAt: nowIso(),
        };
      })
    );
  }, []);

  const deleteAdvanceLoan = useCallback((id) => {
    setAdvancesLoans((current) => current.filter((record) => record.id !== id));
  }, []);

  /* ============================= DEDUCTIONS ============================= */

  const addDeduction = useCallback((data) => {
    const deduction = {
      id: uid("ded"),
      employeeId: data.employeeId || "",
      employeeName: data.employeeName || "",
      deductionType: data.deductionType || "late-attendance",
      payrollPeriod: data.payrollPeriod || "",
      amount: Number(data.amount) || 0,
      reason: data.reason || "",
      effectiveDate: data.effectiveDate || "",
      status: data.status || "pending",
      notes: data.notes || "",
      createdAt: nowIso(),
    };
    setDeductions((current) => [deduction, ...current]);
    return deduction;
  }, []);

  const updateDeduction = useCallback((id, data) => {
    setDeductions((current) =>
      current.map((deduction) => (deduction.id === id ? { ...deduction, ...data, updatedAt: nowIso() } : deduction))
    );
  }, []);

  const cancelDeduction = useCallback((id) => {
    setDeductions((current) =>
      current.map((deduction) => (deduction.id === id ? { ...deduction, status: "cancelled", updatedAt: nowIso() } : deduction))
    );
  }, []);


  /* ================================ HELPERS ================================ */

  const getDepartment = useCallback(
    (id) => departments.find((department) => department.id === id) || null,
    [departments]
  );

  const getEmployeesByDepartment = useCallback(
    (departmentId) => employees.filter((employee) => employee.departmentId === departmentId),
    [employees]
  );

  const getActiveEmployees = useCallback(
    () => employees.filter((employee) => employee.status === "active"),
    [employees]
  );

  const getDepartmentsCount = useCallback(
    () => departments.filter((department) => department.status === "active").length,
    [departments]
  );

  const getPayrollStatusCounts = useCallback(() => {
    const counts = {};
    PAYROLL_STATUSES.forEach((item) => {
      counts[item.value] = payrollEntries.filter((entry) => entry.status === item.value).length;
    });
    return counts;
  }, [payrollEntries]);

  const getLeaveCounts = useCallback(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    leaveRequests.forEach((request) => {
      if (counts[request.status] !== undefined) counts[request.status] += 1;
    });
    return counts;
  }, [leaveRequests]);

  const getAttendanceToday = useCallback(() => {
    if (!todayKey) return [];

    const isToday = (value) => {
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;

      const recordDayKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      return recordDayKey === todayKey;
    };
    return attendance.filter((record) => isToday(record.date));
  }, [attendance, todayKey]);

  const getActivePayrollPeriods = useCallback(
    () =>
      payrollPeriods.filter(
        (period) => period.status === "processing" || period.status === "pending-review" || period.status === "approved"
      ).length,
    [payrollPeriods]
  );

  const getPendingPayrollEntries = useCallback(
    () => payrollEntries.filter((entry) => entry.status === "draft" || entry.status === "pending-review").length,
    [payrollEntries]
  );

  const getPayrollStatus = useCallback(() => {
    if (
      payrollPeriods.some(
        (period) => period.status === "processing" || period.status === "pending-review" || period.status === "approved"
      )
    ) {
      return "processing";
    }
    if (payrollPeriods.some((period) => period.status === "paid")) return "paid";
    if (payrollPeriods.some((period) => period.status === "closed")) return "closed";
    if (payrollPeriods.some((period) => period.status === "draft")) return "draft";
    return "draft";
  }, [payrollPeriods]);

  return {
    employees,
    departments,
    shifts,
    attendance,
    leaveRequests,
    payrollPeriods,
    payrollEntries,
    salaryStructures,
    advancesLoans,
    deductions,
    addEmployee,
    updateEmployee,
    deactivateEmployee,
    getEmployee,
    addDepartment,
    updateDepartment,
    toggleDepartmentStatus,
    addShift,
    updateShift,
    toggleShiftStatus,
    getShift,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    addLeaveRequest,
    updateLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    addPayrollPeriod,
    updatePayrollPeriod,
    closePayrollPeriod,
    getPayrollPeriod,
    addPayrollEntry,
    updatePayrollEntry,
    computePayrollEntry,
    addSalaryStructure,
    updateSalaryStructure,
    toggleSalaryStructureStatus,
    addAdvanceLoan,
    updateAdvanceLoan,
    toggleAdvanceLoanStatus,
    recordRecovery,
    deleteAdvanceLoan,
    addDeduction,
    updateDeduction,
    cancelDeduction,
    getDepartment,
    getEmployeesByDepartment,
    getActiveEmployees,
    getDepartmentsCount,
    getPayrollStatusCounts,
    getLeaveCounts,
    getAttendanceToday,
    getActivePayrollPeriods,
    getPendingPayrollEntries,
    getPayrollStatus,
  };
}

export function PeoplePayrollStoreProvider({ children }) {
  const store = usePeoplePayrollStoreState();
  return createElement(PeoplePayrollStoreContext.Provider, { value: store }, children);
}

export function usePeoplePayrollStore() {
  const store = useContext(PeoplePayrollStoreContext);
  if (!store) {
    throw new Error("usePeoplePayrollStore must be used within PeoplePayrollStoreProvider.");
  }
  return store;
}
