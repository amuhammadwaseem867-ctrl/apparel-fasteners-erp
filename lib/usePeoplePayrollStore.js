"use client";

import { unavailableAction } from "@/lib/backendUnavailable";
/**
 * usePeoplePayrollStore — frontend state store for the People & Payroll module.
 *
 * Read-only state and derived KPIs for the People & Payroll screens.
 * There is no HR/payroll API or database table yet, so all lists are empty
 * and every mutation throws BackendUnavailableError. Salary and personal
 * data must only ever be held server-side behind payroll permissions.
 */

import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";

import { PAYROLL_STATUSES } from "@/config/people-payroll";

const PeoplePayrollStoreContext = createContext(null);

const MODULE_LABEL = "People and payroll";

const addEmployee = unavailableAction(MODULE_LABEL, "addEmployee");
const updateEmployee = unavailableAction(MODULE_LABEL, "updateEmployee");
const deactivateEmployee = unavailableAction(MODULE_LABEL, "deactivateEmployee");
const addDepartment = unavailableAction(MODULE_LABEL, "addDepartment");
const updateDepartment = unavailableAction(MODULE_LABEL, "updateDepartment");
const toggleDepartmentStatus = unavailableAction(MODULE_LABEL, "toggleDepartmentStatus");
const addShift = unavailableAction(MODULE_LABEL, "addShift");
const updateShift = unavailableAction(MODULE_LABEL, "updateShift");
const toggleShiftStatus = unavailableAction(MODULE_LABEL, "toggleShiftStatus");
const addAttendance = unavailableAction(MODULE_LABEL, "addAttendance");
const updateAttendance = unavailableAction(MODULE_LABEL, "updateAttendance");
const deleteAttendance = unavailableAction(MODULE_LABEL, "deleteAttendance");
const addLeaveRequest = unavailableAction(MODULE_LABEL, "addLeaveRequest");
const updateLeaveRequest = unavailableAction(MODULE_LABEL, "updateLeaveRequest");
const approveLeaveRequest = unavailableAction(MODULE_LABEL, "approveLeaveRequest");
const rejectLeaveRequest = unavailableAction(MODULE_LABEL, "rejectLeaveRequest");
const cancelLeaveRequest = unavailableAction(MODULE_LABEL, "cancelLeaveRequest");
const addPayrollPeriod = unavailableAction(MODULE_LABEL, "addPayrollPeriod");
const updatePayrollPeriod = unavailableAction(MODULE_LABEL, "updatePayrollPeriod");
const closePayrollPeriod = unavailableAction(MODULE_LABEL, "closePayrollPeriod");
const addPayrollEntry = unavailableAction(MODULE_LABEL, "addPayrollEntry");
const updatePayrollEntry = unavailableAction(MODULE_LABEL, "updatePayrollEntry");
const computePayrollEntry = unavailableAction(MODULE_LABEL, "computePayrollEntry");
const addSalaryStructure = unavailableAction(MODULE_LABEL, "addSalaryStructure");
const updateSalaryStructure = unavailableAction(MODULE_LABEL, "updateSalaryStructure");
const toggleSalaryStructureStatus = unavailableAction(MODULE_LABEL, "toggleSalaryStructureStatus");
const addAdvanceLoan = unavailableAction(MODULE_LABEL, "addAdvanceLoan");
const updateAdvanceLoan = unavailableAction(MODULE_LABEL, "updateAdvanceLoan");
const toggleAdvanceLoanStatus = unavailableAction(MODULE_LABEL, "toggleAdvanceLoanStatus");
const recordRecovery = unavailableAction(MODULE_LABEL, "recordRecovery");
const deleteAdvanceLoan = unavailableAction(MODULE_LABEL, "deleteAdvanceLoan");
const addDeduction = unavailableAction(MODULE_LABEL, "addDeduction");
const updateDeduction = unavailableAction(MODULE_LABEL, "updateDeduction");
const cancelDeduction = unavailableAction(MODULE_LABEL, "cancelDeduction");

function usePeoplePayrollStoreState() {
  const [employees] = useState([]);
  const [departments] = useState([]);
  const [shifts] = useState([]);
  const [attendance] = useState([]);
  const [todayKey, setTodayKey] = useState("");
  const [leaveRequests] = useState([]);
  const [payrollPeriods] = useState([]);
  const [payrollEntries] = useState([]);
  const [salaryStructures] = useState([]);
  const [advancesLoans] = useState([]);
  const [deductions] = useState([]);

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

  const getEmployee = useCallback(
    (id) => employees.find((employee) => employee.id === id) || null,
    [employees]
  );

  /* ============================ DEPARTMENTS ============================ */

  /* ============================== SHIFTS ============================== */

  const getShift = useCallback(
    (id) => shifts.find((shift) => shift.id === id) || null,
    [shifts]
  );

  /* ============================= ATTENDANCE ============================= */

  /* ============================ LEAVE REQUESTS ============================ */


  /* ============================ PAYROLL PERIOD ============================ */

  const getPayrollPeriod = useCallback(
    (id) => payrollPeriods.find((period) => period.id === id) || null,
    [payrollPeriods]
  );

  /* ============================ PAYROLL ENTRIES ============================ */

  /* ============================ SALARY STRUCTURE ============================ */


  /* =========================== ADVANCES & LOANS =========================== */

  /* ============================= DEDUCTIONS ============================= */


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
