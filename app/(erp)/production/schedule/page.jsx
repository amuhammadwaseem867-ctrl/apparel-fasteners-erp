"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./ProductionSchedule.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ready", label: "Ready" },
  { value: "in_progress", label: "In Progress" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const VIEW_OPTIONS = [
  { value: "list", label: "List View" },
  { value: "calendar", label: "Calendar View" },
];

const STATUS_CONFIG = {
  scheduled: {
    label: "Scheduled",
    className: "scheduled",
  },
  ready: {
    label: "Ready",
    className: "ready",
  },
  in_progress: {
    label: "In Progress",
    className: "in-progress",
  },
  paused: {
    label: "Paused",
    className: "paused",
  },
  completed: {
    label: "Completed",
    className: "completed",
  },
};

export default function ProductionSchedulePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("list");
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Backend-ready data structure.
   *
   * API records should eventually follow:
   *
   * {
   *   id,
   *   workOrder,
   *   productionPlan,
   *   productName,
   *   category,
   *   workCenter,
   *   operation,
   *   date,
   *   startTime,
   *   endTime,
   *   shift,
   *   quantity,
   *   status
   * }
   */

  const schedule = [];

  const filteredSchedule = useMemo(() => {
    const query = search.trim().toLowerCase();

    return schedule.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.workOrder,
          item.productionPlan,
          item.productName,
          item.category,
          item.workCenter,
          item.operation,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesStatus =
        status === "all" ||
        item.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  const handleRefresh = async () => {
    setRefreshing(true);

    /*
     * API refresh will be connected during backend phase.
     */

    await new Promise((resolve) =>
      setTimeout(resolve, 350)
    );

    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const hasFilters =
    search.trim() || status !== "all";

  return (
    <div className="production-schedule-page">
      <PageHeader
        eyebrow="Production"
        title="Production Schedule"
        description="Plan, schedule and monitor production activities across work centers."
      />

      <section className="production-schedule-toolbar">
        <div className="production-schedule-toolbar__search">
          <Search
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
          />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search work orders, products, work centers..."
            aria-label="Search production schedule"
          />
        </div>

        <div className="production-schedule-toolbar__controls">
          <div className="production-schedule-filter">
            <SlidersHorizontal
              size={15}
              strokeWidth={1.8}
            />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter schedule by status"
            >
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="production-schedule-view">
            <select
              value={view}
              onChange={(event) =>
                setView(event.target.value)
              }
              aria-label="Select schedule view"
            >
              {VIEW_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </section>

      <section className="production-schedule-navigation">
        <button
          type="button"
          className="production-schedule-nav-button"
          aria-label="Previous period"
        >
          <ChevronLeft size={17} />
        </button>

        <div className="production-schedule-period">
          <strong>Production Schedule</strong>
          <span>Current planning period</span>
        </div>

        <button
          type="button"
          className="production-schedule-nav-button"
          aria-label="Next period"
        >
          <ChevronRight size={17} />
        </button>
      </section>

      <section className="production-schedule-summary">
        <div className="production-schedule-summary__item">
          <span>Scheduled Jobs</span>
          <strong>{filteredSchedule.length}</strong>
        </div>

        <div className="production-schedule-summary__item">
          <span>Work Centers</span>
          <strong>—</strong>
        </div>

        <div className="production-schedule-summary__item">
          <span>Planned Hours</span>
          <strong>—</strong>
        </div>

        <div className="production-schedule-summary__item">
          <span>Capacity Utilization</span>
          <strong>—</strong>
        </div>
      </section>

      <section className="production-schedule-content">
        {view === "calendar" ? (
          <ScheduleCalendar
            items={filteredSchedule}
          />
        ) : filteredSchedule.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              hasFilters
                ? "No matching schedule entries"
                : "No production schedule"
            }
            description={
              hasFilters
                ? "Try changing your search or status filter."
                : "Scheduled production activities will appear here when production plans are released."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              ) : null
            }
          />
        ) : (
          <ScheduleTable items={filteredSchedule} />
        )}
      </section>
    </div>
  );
}

function ScheduleTable({ items }) {
  return (
    <div className="production-schedule-table-wrap">
      <table className="production-schedule-table">
        <thead>
          <tr>
            <th>Work Order</th>
            <th>Production Plan</th>
            <th>Product</th>
            <th>Operation</th>
            <th>Work Center</th>
            <th>Date</th>
            <th>Shift</th>
            <th>Start</th>
            <th>End</th>
            <th>Quantity</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const status =
              STATUS_CONFIG[item.status] || {
                label: item.status || "—",
                className: "scheduled",
              };

            return (
              <tr key={item.id || item.workOrder}>
                <td>
                  <strong>
                    {item.workOrder || "—"}
                  </strong>
                </td>

                <td>
                  {item.productionPlan || "—"}
                </td>

                <td>
                  {item.productName || "—"}
                </td>

                <td>
                  {item.operation || "—"}
                </td>

                <td>
                  {item.workCenter || "—"}
                </td>

                <td>
                  {item.date || "—"}
                </td>

                <td>
                  {item.shift || "—"}
                </td>

                <td>
                  {item.startTime || "—"}
                </td>

                <td>
                  {item.endTime || "—"}
                </td>

                <td>
                  {item.quantity ?? "—"}
                </td>

                <td>
                  <span
                    className={`production-schedule-status production-schedule-status--${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleCalendar({ items }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No scheduled production"
        description="Calendar entries will appear here when production activities are scheduled."
        size="default"
      />
    );
  }

  return (
    <div className="production-schedule-calendar">
      {items.map((item) => {
        const status =
          STATUS_CONFIG[item.status] || {
            label: item.status || "—",
            className: "scheduled",
          };

        return (
          <article
            key={item.id || item.workOrder}
            className="production-calendar-card"
          >
            <div className="production-calendar-card__top">
              <span>
                {item.date || "—"}
              </span>

              <span
                className={`production-schedule-status production-schedule-status--${status.className}`}
              >
                {status.label}
              </span>
            </div>

            <h3>
              {item.workOrder || "Production Job"}
            </h3>

            <p>
              {item.productName || "—"}
            </p>

            <div className="production-calendar-card__meta">
              <span>
                {item.workCenter || "—"}
              </span>

              <span>
                {item.startTime || "—"} –{" "}
                {item.endTime || "—"}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}