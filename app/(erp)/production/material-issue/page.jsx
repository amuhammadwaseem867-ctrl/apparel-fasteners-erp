"use client";

import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./MaterialIssue.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partially Issued" },
  { value: "issued", label: "Issued" },
  { value: "blocked", label: "Blocked" },
];

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "pending",
  },
  partial: {
    label: "Partially Issued",
    className: "partial",
  },
  issued: {
    label: "Issued",
    className: "issued",
  },
  blocked: {
    label: "Blocked",
    className: "blocked",
  },
};

export default function MaterialIssuePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Backend-ready structure:
   *
   * {
   *   id,
   *   issueNumber,
   *   workOrder,
   *   productionPlan,
   *   productName,
   *   materialCode,
   *   materialName,
   *   category,
   *   warehouse,
   *   batch,
   *   unit,
   *   requiredQuantity,
   *   issuedQuantity,
   *   remainingQuantity,
   *   issueDate,
   *   status
   * }
   */

  const materialIssues = [];

  const filteredIssues = useMemo(() => {
    const query = search.trim().toLowerCase();

    return materialIssues.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.issueNumber,
          item.workOrder,
          item.productionPlan,
          item.productName,
          item.materialCode,
          item.materialName,
          item.category,
          item.warehouse,
          item.batch,
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
    <div className="material-issue-page">
      <PageHeader
        eyebrow="Production"
        title="Material Issue"
        description="Issue required materials and components to production work orders."
      />

      <section className="material-issue-toolbar">
        <div className="material-issue-toolbar__search">
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
            placeholder="Search work orders, materials, batches..."
            aria-label="Search material issues"
          />
        </div>

        <div className="material-issue-toolbar__controls">
          <div className="material-issue-filter">
            <SlidersHorizontal
              size={15}
              strokeWidth={1.8}
            />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter material issues by status"
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

      <section className="material-issue-summary">
        <SummaryItem
          label="Issue Requests"
          value={filteredIssues.length}
        />

        <SummaryItem
          label="Pending"
          value={getCount(
            filteredIssues,
            "pending"
          )}
        />

        <SummaryItem
          label="Partially Issued"
          value={getCount(
            filteredIssues,
            "partial"
          )}
        />

        <SummaryItem
          label="Issued"
          value={getCount(
            filteredIssues,
            "issued"
          )}
        />

        <SummaryItem
          label="Blocked"
          value={getCount(
            filteredIssues,
            "blocked"
          )}
        />
      </section>

      <section className="material-issue-content">
        {filteredIssues.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={
              hasFilters
                ? "No matching material issues"
                : "No material issue requests"
            }
            description={
              hasFilters
                ? "Try changing your search or status filter."
                : "Material issue requests will appear here when production requires inventory materials."
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
          <MaterialIssueTable
            items={filteredIssues}
          />
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="material-issue-summary__item">
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

function MaterialIssueTable({ items }) {
  return (
    <div className="material-issue-table-wrap">
      <table className="material-issue-table">
        <thead>
          <tr>
            <th>Issue No.</th>
            <th>Work Order</th>
            <th>Product</th>
            <th>Material</th>
            <th>Category</th>
            <th>Warehouse</th>
            <th>Batch / Lot</th>
            <th>Required</th>
            <th>Issued</th>
            <th>Remaining</th>
            <th>Unit</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const status =
              STATUS_CONFIG[item.status] || {
                label: item.status || "—",
                className: "pending",
              };

            return (
              <tr key={item.id || item.issueNumber}>
                <td>
                  <strong>
                    {item.issueNumber || "—"}
                  </strong>
                </td>

                <td>
                  {item.workOrder || "—"}
                </td>

                <td>
                  {item.productName || "—"}
                </td>

                <td>
                  <div className="material-cell">
                    <strong>
                      {item.materialName || "—"}
                    </strong>

                    {item.materialCode && (
                      <span>
                        {item.materialCode}
                      </span>
                    )}
                  </div>
                </td>

                <td>
                  {item.category || "—"}
                </td>

                <td>
                  {item.warehouse || "—"}
                </td>

                <td>
                  {item.batch || "—"}
                </td>

                <td>
                  {item.requiredQuantity ?? "—"}
                </td>

                <td>
                  {item.issuedQuantity ?? "—"}
                </td>

                <td>
                  <RemainingQuantity item={item} />
                </td>

                <td>
                  {item.unit || "—"}
                </td>

                <td>
                  <span
                    className={`material-issue-status material-issue-status--${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                <td>
                  <MaterialIssueAction
                    status={item.status}
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

function RemainingQuantity({ item }) {
  if (
    item.remainingQuantity === undefined ||
    item.remainingQuantity === null
  ) {
    return "—";
  }

  const remaining = Number(
    item.remainingQuantity
  );

  if (remaining > 0) {
    return (
      <span className="remaining-quantity">
        {remaining}
      </span>
    );
  }

  return (
    <span className="remaining-quantity remaining-quantity--complete">
      0
    </span>
  );
}

function MaterialIssueAction({ status }) {
  if (status === "pending") {
    return (
      <button
        type="button"
        className="material-issue-action"
        aria-label="Issue material"
      >
        <PackageCheck size={14} />
        <span>Issue</span>
      </button>
    );
  }

  if (status === "partial") {
    return (
      <button
        type="button"
        className="material-issue-action material-issue-action--warning"
        aria-label="Continue material issue"
      >
        <PackageCheck size={14} />
        <span>Continue</span>
      </button>
    );
  }

  if (status === "blocked") {
    return (
      <button
        type="button"
        className="material-issue-action material-issue-action--blocked"
        aria-label="View material shortage"
      >
        <AlertTriangle size={14} />
        <span>Review</span>
      </button>
    );
  }

  return (
    <span className="material-issue-complete">
      <PackageCheck size={14} />
    </span>
  );
}