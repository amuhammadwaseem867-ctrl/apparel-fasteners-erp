"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  Clock,
  CreditCard,
  DollarSign,
  FileBarChart,
  Plane,
  Receipt,
  UserPlus,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { usePeoplePayrollStore } from "@/lib/usePeoplePayrollStore";

import "./overview.css";

const QUICK_ACCESS = [
  { label: "Employees", href: "/people-payroll/employees", icon: Users },
  { label: "Departments", href: "/people-payroll/departments", icon: Building2 },
  { label: "Attendance", href: "/people-payroll/attendance", icon: CalendarCheck },
  { label: "Shifts", href: "/people-payroll/shifts", icon: Clock },
  { label: "Leave Management", href: "/people-payroll/leave", icon: Plane },
  { label: "Payroll", href: "/people-payroll/payroll", icon: DollarSign },
  { label: "Salary Structure", href: "/people-payroll/salary-structure", icon: Receipt },
  { label: "Advances & Loans", href: "/people-payroll/advances-loans", icon: CreditCard },
  { label: "Deductions", href: "/people-payroll/deductions", icon: FileBarChart },
  { label: "Payroll Reports", href: "/people-payroll/reports", icon: FileBarChart },
];

const WORKFLOW = [
  "Attendance",
  "Overtime",
  "Leave / Absence",
  "Allowances",
  "Deductions",
  "Salary Calculation",
  "Payroll Review",
  "Approval",
  "Payslip",
  "Payroll History",
];

export default function PeoplePayrollOverviewPage() {
  const router = useRouter();
  const store = usePeoplePayrollStore();

  const activeEmployees = store.getActiveEmployees();
  const departmentsCount = store.getDepartmentsCount();
  const attendanceToday = store.getAttendanceToday();
  const leaveCounts = store.getLeaveCounts();
  const activePayrollPeriods = store.getActivePayrollPeriods();
  const pendingPayroll = store.getPendingPayrollEntries();
  const payrollStatus = store.getPayrollStatus();

  const presentToday = attendanceToday.filter((record) => record.status === "present" || record.status === "late").length;
  const absentToday = attendanceToday.filter((record) => record.status === "absent").length;
  const onLeave = leaveCounts.approved;

  const hasData = store.employees.length > 0 || store.departments.length > 0 || store.attendance.length > 0 || store.payrollPeriods.length > 0;

  function kpi(value, hint) {
    const empty = value === null || value === undefined || value === "";
    return (
      <div className="pp-kpi" key={hint}>
        <span className="pp-kpi__label">{hint}</span>
        <span className={"pp-kpi__value" + (empty ? " pp-kpi__value--empty" : "")}>{empty ? "—" : value}</span>
        <span className="pp-kpi__hint">{empty ? "No data available" : "Live record"}</span>
      </div>
    );
  }

  function kpiCount(count) {
    return count > 0 ? String(count) : null;
  }

  return (
    <main className="pp-overview">
      <PageHeader
        eyebrow="PEOPLE & PAYROLL"
        title="People & Payroll"
        description="Manage employees, attendance, shifts, leave, salary structures and payroll operations."
        action={
          <div className="pp-overview__header-actions">
            <Button variant="secondary" icon={UserPlus} onClick={() => router.push("/people-payroll/employees")}>
              Add Employee
            </Button>
            <Button variant="secondary" icon={CalendarCheck} onClick={() => router.push("/people-payroll/attendance")}>
              Record Attendance
            </Button>
            <Button variant="secondary" icon={Receipt} onClick={() => router.push("/people-payroll/payroll")}>
              Create Payroll Period
            </Button>
            <Button variant="primary" icon={DollarSign} onClick={() => router.push("/people-payroll/payroll")}>
              View Payroll
            </Button>
          </div>
        }
      />

      <div className="pp-kpi-grid">
        {kpi(kpiCount(activeEmployees.length), "Total Employees")}
        {kpi(kpiCount(presentToday), "Present Today")}
        {kpi(kpiCount(absentToday), "Absent Today")}
        {kpi(kpiCount(onLeave), "On Leave")}
        {kpi(kpiCount(departmentsCount), "Active Departments")}
        {kpi(activePayrollPeriods > 0 ? String(activePayrollPeriods) : null, "Current Payroll Period")}
        {kpi(pendingPayroll > 0 ? String(pendingPayroll) : null, "Pending Payroll")}
        {kpi(hasData && payrollStatus ? payrollStatus : null, "Payroll Status")}
      </div>

      <div className="pp-grid-2">
        <section className="pp-overview__section">
          <div className="pp-overview__section-head">
            <div>
              <h2 className="pp-overview__section-title">Workforce Overview</h2>
              <p className="pp-overview__section-sub">Headcount and department distribution</p>
            </div>
            <Link className="pp-overview__section-sub" href="/people-payroll/employees">Open</Link>
          </div>
          <div className="pp-overview__section-body">
            {store.employees.length === 0 ? (
              <EmptyState icon={Users} title="No employees yet" description="Employee records will appear here once added." size="small" />
            ) : (
              <ul className="pp-list">
                <li className="pp-list__item"><span>Total employees</span><strong>{store.employees.length}</strong></li>
                <li className="pp-list__item"><span>Active</span><strong>{activeEmployees.length}</strong></li>
                <li className="pp-list__item"><span>Departments</span><strong>{store.departments.length}</strong></li>
              </ul>
            )}
          </div>
        </section>

        <section className="pp-overview__section">
          <div className="pp-overview__section-head">
            <div>
              <h2 className="pp-overview__section-title">Attendance Summary</h2>
              <p className="pp-overview__section-sub">Today&apos;s attendance records</p>
            </div>
            <Link className="pp-overview__section-sub" href="/people-payroll/attendance">Open</Link>
          </div>
          <div className="pp-overview__section-body">
            {attendanceToday.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No attendance today" description="Attendance records for today will appear here." size="small" />
            ) : (
              <ul className="pp-list">
                <li className="pp-list__item"><span>Present</span><strong>{presentToday}</strong></li>
                <li className="pp-list__item"><span>Absent</span><strong>{absentToday}</strong></li>
                <li className="pp-list__item"><span>Records</span><strong>{attendanceToday.length}</strong></li>
              </ul>
            )}
          </div>
        </section>

        <section className="pp-overview__section">
          <div className="pp-overview__section-head">
            <div>
              <h2 className="pp-overview__section-title">Payroll Status</h2>
              <p className="pp-overview__section-sub">Current payroll period and review</p>
            </div>
            <Link className="pp-overview__section-sub" href="/people-payroll/payroll">Open</Link>
          </div>
          <div className="pp-overview__section-body">
            {store.payrollPeriods.length === 0 ? (
              <EmptyState icon={DollarSign} title="No payroll period" description="Create a payroll period to begin processing." size="small" />
            ) : (
              <ul className="pp-list">
                {store.payrollPeriods.slice(0, 4).map((period) => (
                  <li className="pp-list__item" key={period.id}><span>{period.periodName}</span><strong>{period.status}</strong></li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="pp-overview__section">
          <div className="pp-overview__section-head">
            <div>
              <h2 className="pp-overview__section-title">Leave Requests</h2>
              <p className="pp-overview__section-sub">Pending and recent requests</p>
            </div>
            <Link className="pp-overview__section-sub" href="/people-payroll/leave">Open</Link>
          </div>
          <div className="pp-overview__section-body">
            {store.leaveRequests.length === 0 ? (
              <EmptyState icon={Plane} title="No leave requests" description="Leave requests submitted by employees will appear here." size="small" />
            ) : (
              <ul className="pp-list">
                <li className="pp-list__item"><span>Pending</span><strong>{leaveCounts.pending}</strong></li>
                <li className="pp-list__item"><span>Approved</span><strong>{leaveCounts.approved}</strong></li>
                <li className="pp-list__item"><span>Rejected</span><strong>{leaveCounts.rejected}</strong></li>
              </ul>
            )}
          </div>
        </section>
      </div>


      <section className="pp-overview__section">
        <div className="pp-overview__section-head">
          <div>
            <h2 className="pp-overview__section-title">Payroll Workflow</h2>
            <p className="pp-overview__section-sub">End-to-end payroll processing sequence</p>
          </div>
        </div>
        <div className="pp-overview__section-body">
          <div className="pp-workflow">
            {WORKFLOW.map((step) => (
              <span className="pp-workflow__step" key={step}>{step}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="pp-overview__section">
        <div className="pp-overview__section-head">
          <div>
            <h2 className="pp-overview__section-title">Recent HR Activity</h2>
            <p className="pp-overview__section-sub">Latest changes across the module</p>
          </div>
        </div>
        <div className="pp-overview__section-body">
          {store.employees.length === 0 && store.leaveRequests.length === 0 && store.attendance.length === 0 ? (
            <EmptyState icon={Receipt} title="No recent activity" description="HR activity will appear here once records are created." size="small" />
          ) : (
            <ul className="pp-list">
              {store.employees.slice(0, 5).map((employee) => (
                <li className="pp-list__item" key={employee.id}>
                  <span>Employee {employee.fullName} added</span>
                  <span className="pp-list__muted">{employee.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="pp-overview__section">
        <div className="pp-overview__section-head">
          <div>
            <h2 className="pp-overview__section-title">Quick Access Modules</h2>
            <p className="pp-overview__section-sub">Jump directly to a module</p>
          </div>
        </div>
        <div className="pp-overview__section-body">
          <div className="pp-quick-grid">
            {QUICK_ACCESS.map((item) => (
              <Link className="pp-quick" href={item.href} key={item.href}>
                <span className="pp-quick__icon"><item.icon size={17} /></span>
                <span className="pp-quick__label">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

