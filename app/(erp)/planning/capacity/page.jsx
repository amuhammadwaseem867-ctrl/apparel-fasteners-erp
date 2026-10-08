"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  Factory,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./CapacityPlanning.css";

const STATUS_CONFIG = {
  available: {
    label: "Available",
    icon: CheckCircle2,
    className: "available",
  },
  balanced: {
    label: "Balanced",
    icon: CheckCircle2,
    className: "balanced",
  },
  near_capacity: {
    label: "Near Capacity",
    icon: Clock3,
    className: "warning",
  },
  overloaded: {
    label: "Overloaded",
    icon: AlertTriangle,
    className: "danger",
  },
};

export default function CapacityPlanningPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  /*
   * Backend integration point.
   *
   * Capacity data will later come from:
   *
   * Work Centers
   *      +
   * Working Calendars
   *      +
   * Production Plans
   *      +
   * Routing / Operations
   *      ↓
   * Capacity Engine
   *
   * No mock records are intentionally used.
   */
  const workCenters = useMemo(() => [], []);

  const filteredWorkCenters = useMemo(() => {
    return workCenters.filter((workCenter) => {
      const searchableText = [
        workCenter.code,
        workCenter.name,
        workCenter.department,
        workCenter.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        searchableText.includes(
          search.toLowerCase()
        );

      const matchesStatus =
        status === "all" ||
        workCenter.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [workCenters, search, status]);

  const handleRefresh = () => {
    /*
     * API refresh will be implemented later.
     */
  };

  return (
    <main className="capacity-planning">
      <PageHeader
        eyebrow="PLANNING / CAPACITY"
        title="Capacity Planning"
        description="Monitor available production capacity against planned workloads and identify potential bottlenecks."
        action={
          <Button
            variant="primary"
            size="md"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
      />

      <div className="capacity-planning__content">
        <section className="capacity-planning__summary">
          <div className="capacity-planning__summary-item">
            <span className="capacity-planning__summary-label">
              Available Capacity
            </span>

            <strong>—</strong>

            <span>
              Hours available
            </span>
          </div>

          <div className="capacity-planning__summary-item">
            <span className="capacity-planning__summary-label">
              Planned Load
            </span>

            <strong>—</strong>

            <span>
              Hours scheduled
            </span>
          </div>

          <div className="capacity-planning__summary-item">
            <span className="capacity-planning__summary-label">
              Utilization
            </span>

            <strong>—</strong>

            <span>
              Current planned utilization
            </span>
          </div>

          <div className="capacity-planning__summary-item capacity-planning__summary-item--alert">
            <span className="capacity-planning__summary-label">
              Overloaded Centers
            </span>

            <strong>—</strong>

            <span>
              Require scheduling action
            </span>
          </div>
        </section>

        <section className="capacity-planning__toolbar">
          <div className="capacity-planning__search">
            <Search
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search work center, department..."
              aria-label="Search work centers"
            />
          </div>

          <div className="capacity-planning__filters">
            <label htmlFor="capacity-status">
              Status
            </label>

            <select
              id="capacity-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="available">
                Available
              </option>

              <option value="balanced">
                Balanced
              </option>

              <option value="near_capacity">
                Near Capacity
              </option>

              <option value="overloaded">
                Overloaded
              </option>
            </select>
          </div>
        </section>

        <section className="capacity-planning__table-card">
          <div className="capacity-planning__table-header">
            <div>
              <h2>
                Work Center Capacity
              </h2>

              <p>
                {workCenters.length} work center
                {workCenters.length === 1
                  ? ""
                  : "s"} available
              </p>
            </div>

            <div className="capacity-planning__header-summary">
              <span>
                Planning Horizon: —
              </span>

              <span>
                Last Calculation: —
              </span>
            </div>
          </div>

          {filteredWorkCenters.length > 0 ? (
            <div className="capacity-planning__table-wrap">
              <table className="capacity-planning__table">
                <thead>
                  <tr>
                    <th>Work Center</th>
                    <th>Department</th>
                    <th>Available Hours</th>
                    <th>Planned Hours</th>
                    <th>Remaining</th>
                    <th>Utilization</th>
                    <th>Scheduled Jobs</th>
                    <th>Next Available</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWorkCenters.map(
                    (workCenter) => {
                      const statusConfig =
                        STATUS_CONFIG[
                          workCenter.status
                        ] ||
                        STATUS_CONFIG.available;

                      const StatusIcon =
                        statusConfig.icon;

                      const utilization =
                        workCenter.utilization ??
                        null;

                      return (
                        <tr
                          key={workCenter.id}
                        >
                          <td>
                            <div className="capacity-planning__work-center">
                              <div className="capacity-planning__work-center-icon">
                                <Factory
                                  size={16}
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                />
                              </div>

                              <div>
                                <strong>
                                  {workCenter.name ||
                                    "—"}
                                </strong>

                                <span>
                                  {workCenter.code ||
                                    "—"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            {workCenter.department ||
                              "—"}
                          </td>

                          <td>
                            {workCenter.availableHours ??
                              "—"}
                          </td>

                          <td>
                            {workCenter.plannedHours ??
                              "—"}
                          </td>

                          <td>
                            {workCenter.remainingHours ??
                              "—"}
                          </td>

                          <td>
                            <div className="capacity-planning__utilization">
                              <div className="capacity-planning__utilization-bar">
                                <span
                                  style={{
                                    width:
                                      utilization !==
                                      null
                                        ? `${Math.min(
                                            Math.max(
                                              utilization,
                                              0
                                            ),
                                            100
                                          )}%`
                                        : "0%",
                                  }}
                                />
                              </div>

                              <strong>
                                {utilization !== null
                                  ? `${utilization}%`
                                  : "—"}
                              </strong>
                            </div>
                          </td>

                          <td>
                            {workCenter.scheduledJobs ??
                              "—"}
                          </td>

                          <td>
                            <span className="capacity-planning__date">
                              <CalendarDays
                                size={14}
                                strokeWidth={1.8}
                                aria-hidden="true"
                              />

                              {workCenter.nextAvailable ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`capacity-planning__status capacity-planning__status--${statusConfig.className}`}
                            >
                              <StatusIcon
                                size={13}
                                strokeWidth={1.9}
                                aria-hidden="true"
                              />

                              {statusConfig.label}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Factory}
              title="No capacity data"
              description={
                search || status !== "all"
                  ? "No work centers match the selected filters."
                  : "Work center capacity and planned production load will appear here once planning data is available."
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}