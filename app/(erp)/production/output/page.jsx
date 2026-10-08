"use client";

import { useMemo, useState } from "react";
import {
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./ProductionOutput.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending Recording" },
  { value: "recorded", label: "Recorded" },
  { value: "partial", label: "Partially Recorded" },
  { value: "rejected", label: "Rejected / Review" },
];

const STATUS_CONFIG = {
  pending: {
    label: "Pending Recording",
    className: "pending",
  },
  recorded: {
    label: "Recorded",
    className: "recorded",
  },
  partial: {
    label: "Partially Recorded",
    className: "partial",
  },
  rejected: {
    label: "Rejected / Review",
    className: "rejected",
  },
};

export default function ProductionOutputPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Backend-ready structure:
   *
   * {
   *   id,
   *   outputNumber,
   *   workOrder,
   *   productionPlan,
   *   productName,
   *   category,
   *   operation,
   *   workCenter,
   *   batch,
   *   unit,
   *   plannedQuantity,
   *   producedQuantity,
   *   rejectedQuantity,
   *   goodQuantity,
   *   productionDate,
   *   recordedBy,
   *   status
   * }
   */

  const outputs = [];

  const filteredOutputs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return outputs.filter((output) => {
      const matchesSearch =
        !query ||
        [
          output.outputNumber,
          output.workOrder,
          output.productionPlan,
          output.productName,
          output.category,
          output.operation,
          output.workCenter,
          output.batch,
          output.recordedBy,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesStatus =
        status === "all" ||
        output.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  const handleRefresh = async () => {
    setRefreshing(true);

    /*
     * API refresh will be connected during backend integration.
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
    <div className="production-output-page">
      <PageHeader
        eyebrow="Production"
        title="Production Output"
        description="Record finished production quantities, rejects, batches and actual output against work orders."
      />

      <section className="production-output-toolbar">
        <div className="production-output-toolbar__search">
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
            placeholder="Search work orders, products, batches..."
            aria-label="Search production output"
          />
        </div>

        <div className="production-output-toolbar__controls">
          <div className="production-output-filter">
            <SlidersHorizontal
              size={15}
              strokeWidth={1.8}
            />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter production output by status"
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

      <section className="production-output-summary">
        <SummaryItem
          label="Output Records"
          value={filteredOutputs.length}
        />

        <SummaryItem
          label="Pending"
          value={getCount(
            filteredOutputs,
            "pending"
          )}
        />

        <SummaryItem
          label="Recorded"
          value={getCount(
            filteredOutputs,
            "recorded"
          )}
        />

        <SummaryItem
          label="Partial"
          value={getCount(
            filteredOutputs,
            "partial"
          )}
        />

        <SummaryItem
          label="Review"
          value={getCount(
            filteredOutputs,
            "rejected"
          )}
        />
      </section>

      <section className="production-output-content">
        {filteredOutputs.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title={
              hasFilters
                ? "No matching output records"
                : "No production output recorded"
            }
            description={
              hasFilters
                ? "Try changing your search or status filter."
                : "Production output records will appear here when quantities are recorded from the shop floor."
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
          <ProductionOutputTable
            outputs={filteredOutputs}
          />
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="production-output-summary__item">
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

function ProductionOutputTable({ outputs }) {
  return (
    <div className="production-output-table-wrap">
      <table className="production-output-table">
        <thead>
          <tr>
            <th>Output No.</th>
            <th>Work Order</th>
            <th>Product</th>
            <th>Operation</th>
            <th>Work Center</th>
            <th>Batch / Lot</th>
            <th>Planned</th>
            <th>Produced</th>
            <th>Rejected</th>
            <th>Good Output</th>
            <th>Unit</th>
            <th>Production Date</th>
            <th>Recorded By</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {outputs.map((output) => {
            const status =
              STATUS_CONFIG[output.status] || {
                label: output.status || "—",
                className: "pending",
              };

            const goodQuantity =
              output.goodQuantity !== undefined &&
              output.goodQuantity !== null
                ? output.goodQuantity
                : calculateGoodQuantity(output);

            return (
              <tr
                key={
                  output.id ||
                  output.outputNumber
                }
              >
                <td>
                  <strong>
                    {output.outputNumber || "—"}
                  </strong>
                </td>

                <td>
                  {output.workOrder || "—"}
                </td>

                <td>
                  {output.productName || "—"}
                </td>

                <td>
                  {output.operation || "—"}
                </td>

                <td>
                  {output.workCenter || "—"}
                </td>

                <td>
                  {output.batch || "—"}
                </td>

                <td>
                  {output.plannedQuantity ?? "—"}
                </td>

                <td>
                  {output.producedQuantity ?? "—"}
                </td>

                <td>
                  <span
                    className={
                      Number(
                        output.rejectedQuantity
                      ) > 0
                        ? "output-rejected"
                        : ""
                    }
                  >
                    {output.rejectedQuantity ?? "—"}
                  </span>
                </td>

                <td>
                  <strong className="output-good">
                    {goodQuantity ?? "—"}
                  </strong>
                </td>

                <td>
                  {output.unit || "—"}
                </td>

                <td>
                  {output.productionDate || "—"}
                </td>

                <td>
                  {output.recordedBy || "—"}
                </td>

                <td>
                  <span
                    className={`production-output-status production-output-status--${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                <td>
                  <OutputAction
                    status={output.status}
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

function calculateGoodQuantity(output) {
  const produced = Number(
    output.producedQuantity
  );

  const rejected = Number(
    output.rejectedQuantity
  );

  if (!Number.isFinite(produced)) {
    return null;
  }

  return (
    produced -
    (Number.isFinite(rejected) ? rejected : 0)
  );
}

function OutputAction({ status }) {
  if (
    status === "pending" ||
    status === "partial"
  ) {
    return (
      <button
        type="button"
        className="production-output-action production-output-action--record"
        aria-label="Record production output"
      >
        <PackageCheck size={14} />
        <span>Record</span>
      </button>
    );
  }

  if (status === "rejected") {
    return (
      <button
        type="button"
        className="production-output-action production-output-action--review"
        aria-label="Review production output"
      >
        <AlertTriangle size={14} />
        <span>Review</span>
      </button>
    );
  }

  return (
    <span className="production-output-complete">
      <CheckCircle2 size={14} />
    </span>
  );
}