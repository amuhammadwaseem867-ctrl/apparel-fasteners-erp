"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  LockKeyhole,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./ProductionCompletion.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "ready", label: "Ready for Completion" },
  { value: "qc_pending", label: "QC Pending" },
  { value: "completed", label: "Completed" },
  { value: "variance", label: "Variance Review" },
  { value: "blocked", label: "Blocked" },
];

const STATUS_CONFIG = {
  ready: {
    label: "Ready for Completion",
    className: "ready",
  },
  qc_pending: {
    label: "QC Pending",
    className: "qc-pending",
  },
  completed: {
    label: "Completed",
    className: "completed",
  },
  variance: {
    label: "Variance Review",
    className: "variance",
  },
  blocked: {
    label: "Blocked",
    className: "blocked",
  },
};

export default function ProductionCompletionPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Backend-ready structure:
   *
   * {
   *   id,
   *   completionNumber,
   *   workOrder,
   *   productionPlan,
   *   productName,
   *   category,
   *   plannedQuantity,
   *   producedQuantity,
   *   rejectedQuantity,
   *   goodQuantity,
   *   varianceQuantity,
   *   variancePercent,
   *   unit,
   *   qcStatus,
   *   completionDate,
   *   completedBy,
   *   status
   * }
   */

  const completions = [];

  const filteredCompletions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return completions.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.completionNumber,
          item.workOrder,
          item.productionPlan,
          item.productName,
          item.category,
          item.qcStatus,
          item.completedBy,
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
     * Backend/API refresh will be connected later.
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
    <div className="production-completion-page">
      <PageHeader
        eyebrow="Production"
        title="Production Completion"
        description="Review final production quantities, variances and QC readiness before closing work orders."
      />

      <section className="production-completion-toolbar">
        <div className="production-completion-toolbar__search">
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
            placeholder="Search work orders, products, completion records..."
            aria-label="Search production completion records"
          />
        </div>

        <div className="production-completion-toolbar__controls">
          <div className="production-completion-filter">
            <SlidersHorizontal
              size={15}
              strokeWidth={1.8}
            />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter completion records by status"
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

      <section className="production-completion-summary">
        <SummaryItem
          label="Completion Records"
          value={filteredCompletions.length}
        />

        <SummaryItem
          label="Ready"
          value={getCount(
            filteredCompletions,
            "ready"
          )}
        />

        <SummaryItem
          label="QC Pending"
          value={getCount(
            filteredCompletions,
            "qc_pending"
          )}
        />

        <SummaryItem
          label="Completed"
          value={getCount(
            filteredCompletions,
            "completed"
          )}
        />

        <SummaryItem
          label="Review"
          value={getCount(
            filteredCompletions,
            "variance"
          )}
        />
      </section>

      <section className="production-completion-content">
        {filteredCompletions.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={
              hasFilters
                ? "No matching completion records"
                : "No production completions"
            }
            description={
              hasFilters
                ? "Try changing your search or status filter."
                : "Production completion records will appear here when work orders reach their final production stage."
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
          <ProductionCompletionTable
            completions={filteredCompletions}
          />
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="production-completion-summary__item">
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

function ProductionCompletionTable({
  completions,
}) {
  return (
    <div className="production-completion-table-wrap">
      <table className="production-completion-table">
        <thead>
          <tr>
            <th>Completion No.</th>
            <th>Work Order</th>
            <th>Product</th>
            <th>Category</th>
            <th>Planned</th>
            <th>Produced</th>
            <th>Rejected</th>
            <th>Good Output</th>
            <th>Variance</th>
            <th>QC Status</th>
            <th>Completion Date</th>
            <th>Completed By</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {completions.map((item) => {
            const status =
              STATUS_CONFIG[item.status] || {
                label: item.status || "—",
                className: "ready",
              };

            const goodQuantity =
              item.goodQuantity !== undefined &&
              item.goodQuantity !== null
                ? item.goodQuantity
                : calculateGoodQuantity(item);

            const variance =
              item.varianceQuantity !==
                undefined &&
              item.varianceQuantity !== null
                ? item.varianceQuantity
                : calculateVariance(item);

            return (
              <tr
                key={
                  item.id ||
                  item.completionNumber
                }
              >
                <td>
                  <strong>
                    {item.completionNumber || "—"}
                  </strong>
                </td>

                <td>
                  {item.workOrder || "—"}
                </td>

                <td>
                  {item.productName || "—"}
                </td>

                <td>
                  {item.category || "—"}
                </td>

                <td>
                  {item.plannedQuantity ?? "—"}
                </td>

                <td>
                  {item.producedQuantity ?? "—"}
                </td>

                <td>
                  <span
                    className={
                      Number(
                        item.rejectedQuantity
                      ) > 0
                        ? "completion-rejected"
                        : ""
                    }
                  >
                    {item.rejectedQuantity ?? "—"}
                  </span>
                </td>

                <td>
                  <strong className="completion-good">
                    {goodQuantity ?? "—"}
                  </strong>
                </td>

                <td>
                  <VarianceValue
                    value={variance}
                    percent={
                      item.variancePercent
                    }
                  />
                </td>

                <td>
                  <QCStatus
                    status={item.qcStatus}
                  />
                </td>

                <td>
                  {item.completionDate || "—"}
                </td>

                <td>
                  {item.completedBy || "—"}
                </td>

                <td>
                  <span
                    className={`production-completion-status production-completion-status--${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                <td>
                  <CompletionAction
                    status={item.status}
                    qcStatus={item.qcStatus}
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

function calculateGoodQuantity(item) {
  const produced = Number(
    item.producedQuantity
  );

  const rejected = Number(
    item.rejectedQuantity
  );

  if (!Number.isFinite(produced)) {
    return null;
  }

  return (
    produced -
    (Number.isFinite(rejected) ? rejected : 0)
  );
}

function calculateVariance(item) {
  const planned = Number(
    item.plannedQuantity
  );

  const good = calculateGoodQuantity(item);

  if (
    !Number.isFinite(planned) ||
    !Number.isFinite(good)
  ) {
    return null;
  }

  return good - planned;
}

function VarianceValue({ value, percent }) {
  if (
    value === undefined ||
    value === null
  ) {
    return "—";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  const isNegative = numericValue < 0;

  return (
    <span
      className={
        isNegative
          ? "completion-variance completion-variance--negative"
          : "completion-variance completion-variance--positive"
      }
    >
      {numericValue > 0 ? "+" : ""}
      {numericValue}
      {percent !== undefined &&
        percent !== null && (
          <small>
            {" "}
            ({percent}%)
          </small>
        )}
    </span>
  );
}

function QCStatus({ status }) {
  if (!status) {
    return (
      <span className="completion-qc completion-qc--unknown">
        —
      </span>
    );
  }

  const normalized = String(status)
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    normalized === "passed" ||
    normalized === "approved"
  ) {
    return (
      <span className="completion-qc completion-qc--passed">
        Passed
      </span>
    );
  }

  if (
    normalized === "pending" ||
    normalized === "in_progress"
  ) {
    return (
      <span className="completion-qc completion-qc--pending">
        Pending
      </span>
    );
  }

  return (
    <span className="completion-qc completion-qc--failed">
      {status}
    </span>
  );
}

function CompletionAction({
  status,
  qcStatus,
}) {
  const normalizedQc = String(
    qcStatus || ""
  ).toLowerCase();

  if (status === "completed") {
    return (
      <span className="completion-complete">
        <CheckCircle2 size={14} />
      </span>
    );
  }

  if (status === "blocked") {
    return (
      <button
        type="button"
        className="completion-action completion-action--blocked"
        aria-label="Review blocked completion"
      >
        <LockKeyhole size={14} />
        <span>Review</span>
      </button>
    );
  }

  if (
    status === "qc_pending" ||
    normalizedQc === "pending" ||
    normalizedQc === "in_progress"
  ) {
    return (
      <button
        type="button"
        className="completion-action completion-action--qc"
        aria-label="View quality control"
      >
        <ClipboardCheck size={14} />
        <span>View QC</span>
      </button>
    );
  }

  if (status === "variance") {
    return (
      <button
        type="button"
        className="completion-action completion-action--review"
        aria-label="Review production variance"
      >
        <AlertTriangle size={14} />
        <span>Review</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="completion-action completion-action--complete"
      aria-label="Complete production"
    >
      <CheckCircle2 size={14} />
      <span>Complete</span>
    </button>
  );
}