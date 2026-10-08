"use client";

import { useMemo, useState } from "react";
import {
  Cog,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Play,
  Pause,
  CheckCircle2,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./Operations.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "queued", label: "Queued" },
  { value: "ready", label: "Ready" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const STATUS_CONFIG = {
  queued: {
    label: "Queued",
    className: "queued",
  },
  ready: {
    label: "Ready",
    className: "ready",
  },
  running: {
    label: "Running",
    className: "running",
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

export default function ProductionOperationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Backend-ready operation structure:
   *
   * {
   *   id,
   *   code,
   *   workOrder,
   *   productName,
   *   operation,
   *   workCenter,
   *   operator,
   *   plannedQuantity,
   *   completedQuantity,
   *   rejectedQuantity,
   *   startTime,
   *   dueTime,
   *   progress,
   *   status
   * }
   */

  const operations = [];

  const filteredOperations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return operations.filter((operation) => {
      const matchesSearch =
        !query ||
        [
          operation.code,
          operation.workOrder,
          operation.productName,
          operation.operation,
          operation.workCenter,
          operation.operator,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesStatus =
        status === "all" ||
        operation.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  const handleRefresh = async () => {
    setRefreshing(true);

    /*
     * API refresh will be connected later.
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
    <div className="production-operations-page">
      <PageHeader
        eyebrow="Production"
        title="Operations"
        description="Monitor and control individual production operations across work centers."
      />

      <section className="operations-toolbar">
        <div className="operations-toolbar__search">
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
            placeholder="Search operations, work orders, products..."
            aria-label="Search production operations"
          />
        </div>

        <div className="operations-toolbar__controls">
          <div className="operations-filter">
            <SlidersHorizontal
              size={15}
              strokeWidth={1.8}
            />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter operations by status"
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

      <section className="operations-summary">
        <SummaryItem
          label="Total Operations"
          value={filteredOperations.length}
        />

        <SummaryItem
          label="Queued"
          value={getCount(filteredOperations, "queued")}
        />

        <SummaryItem
          label="Running"
          value={getCount(filteredOperations, "running")}
        />

        <SummaryItem
          label="Completed"
          value={getCount(
            filteredOperations,
            "completed"
          )}
        />
      </section>

      <section className="operations-content">
        {filteredOperations.length === 0 ? (
          <EmptyState
            icon={Cog}
            title={
              hasFilters
                ? "No matching operations"
                : "No production operations"
            }
            description={
              hasFilters
                ? "Try changing your search or status filter."
                : "Production operations will appear here when work orders are released."
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
          <OperationsTable
            operations={filteredOperations}
          />
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="operations-summary__item">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function getCount(items, status) {
  return items.filter(
    (item) => item.status === status
  ).length;
}

function OperationsTable({ operations }) {
  return (
    <div className="operations-table-wrap">
      <table className="operations-table">
        <thead>
          <tr>
            <th>Operation</th>
            <th>Work Order</th>
            <th>Product</th>
            <th>Work Center</th>
            <th>Operator</th>
            <th>Planned Qty</th>
            <th>Completed</th>
            <th>Rejected</th>
            <th>Progress</th>
            <th>Start</th>
            <th>Due</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {operations.map((operation) => {
            const status =
              STATUS_CONFIG[operation.status] || {
                label: operation.status || "—",
                className: "queued",
              };

            const progress = Math.max(
              0,
              Math.min(
                100,
                Number(operation.progress) || 0
              )
            );

            return (
              <tr key={operation.id || operation.code}>
                <td>
                  <strong>
                    {operation.operation ||
                      operation.code ||
                      "—"}
                  </strong>
                </td>

                <td>
                  {operation.workOrder || "—"}
                </td>

                <td>
                  {operation.productName || "—"}
                </td>

                <td>
                  {operation.workCenter || "—"}
                </td>

                <td>
                  {operation.operator || "—"}
                </td>

                <td>
                  {operation.plannedQuantity ?? "—"}
                </td>

                <td>
                  {operation.completedQuantity ?? "—"}
                </td>

                <td>
                  {operation.rejectedQuantity ?? "—"}
                </td>

                <td>
                  <div className="operations-progress">
                    <div className="operations-progress__top">
                      <span>{progress}%</span>
                    </div>

                    <div className="operations-progress__bar">
                      <span
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>

                <td>
                  {operation.startTime || "—"}
                </td>

                <td>
                  {operation.dueTime || "—"}
                </td>

                <td>
                  <span
                    className={`operations-status operations-status--${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                <td>
                  <OperationActions
                    status={operation.status}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OperationActions({ status }) {
  if (status === "running") {
    return (
      <button
        type="button"
        className="operation-action operation-action--pause"
        aria-label="Pause operation"
      >
        <Pause size={14} />
      </button>
    );
  }

  if (status === "paused") {
    return (
      <button
        type="button"
        className="operation-action operation-action--play"
        aria-label="Resume operation"
      >
        <Play size={14} />
      </button>
    );
  }

  if (status === "ready") {
    return (
      <button
        type="button"
        className="operation-action operation-action--play"
        aria-label="Start operation"
      >
        <Play size={14} />
      </button>
    );
  }

  if (status === "completed") {
    return (
      <span className="operation-action-completed">
        <CheckCircle2 size={14} />
      </span>
    );
  }

  return (
    <button
      type="button"
      className="operation-action"
      aria-label="View operation"
    >
      View
    </button>
  );
}