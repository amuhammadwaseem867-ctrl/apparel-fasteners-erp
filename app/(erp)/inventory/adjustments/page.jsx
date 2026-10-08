"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

import "./Adjustments.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    icon: FileText,
    tone: "neutral",
  },
  pending: {
    label: "Pending Approval",
    icon: Clock3,
    tone: "warning",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    tone: "info",
  },
  posted: {
    label: "Posted",
    icon: CheckCircle2,
    tone: "success",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    tone: "danger",
  },
};

export default function AdjustmentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading] = useState(false);

  /*
   * Backend-ready.
   * Adjustment records will be supplied by the API later.
   */
  const adjustments = [];

  const filteredAdjustments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return adjustments.filter((adjustment) => {
      const matchesSearch =
        !query ||
        adjustment.reference?.toLowerCase().includes(query) ||
        adjustment.product?.toLowerCase().includes(query) ||
        adjustment.sku?.toLowerCase().includes(query) ||
        adjustment.warehouse?.toLowerCase().includes(query);

      const matchesStatus =
        status === "all" || adjustment.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [adjustments, search, status]);

  const increaseCount = adjustments.filter(
    (item) => item.direction === "increase"
  ).length;

  const decreaseCount = adjustments.filter(
    (item) => item.direction === "decrease"
  ).length;

  const pendingCount = adjustments.filter(
    (item) => item.status === "pending"
  ).length;

  const postedCount = adjustments.filter(
    (item) => item.status === "posted"
  ).length;

  const hasFilters = search || status !== "all";

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const handleNewAdjustment = () => {
    /* Backend integration pending. */
  };

  const handleExport = () => {
    /* Backend integration pending. */
  };

  return (
    <main className="inventory-adjustments">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Adjustments"
        description="Correct inventory differences with controlled quantity changes, reasons, approvals, and audit history."
        action={
          <div className="inventory-adjustments__header-actions">
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={
                loading ||
                filteredAdjustments.length === 0
              }
            >
              <Download size={15} />
              Export
            </Button>

            <Button
              variant="primary"
              onClick={handleNewAdjustment}
            >
              <Plus size={15} />
              New Adjustment
            </Button>
          </div>
        }
      />

      <div className="inventory-adjustments__content">
        {/* SUMMARY */}

        <section className="inventory-adjustments__summary">
          <div className="inventory-adjustments__summary-card">
            <div className="inventory-adjustments__summary-icon">
              <SlidersHorizontal size={18} />
            </div>

            <div>
              <span>Total Adjustments</span>
              <strong>{adjustments.length}</strong>
            </div>
          </div>

          <div className="inventory-adjustments__summary-card">
            <div className="inventory-adjustments__summary-icon inventory-adjustments__summary-icon--success">
              <ArrowUpFromLine size={18} />
            </div>

            <div>
              <span>Stock Increases</span>
              <strong>{increaseCount}</strong>
            </div>
          </div>

          <div className="inventory-adjustments__summary-card">
            <div className="inventory-adjustments__summary-icon inventory-adjustments__summary-icon--danger">
              <ArrowDownToLine size={18} />
            </div>

            <div>
              <span>Stock Decreases</span>
              <strong>{decreaseCount}</strong>
            </div>
          </div>

          <div className="inventory-adjustments__summary-card">
            <div className="inventory-adjustments__summary-icon inventory-adjustments__summary-icon--warning">
              <Clock3 size={18} />
            </div>

            <div>
              <span>Pending Approval</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>

          <div className="inventory-adjustments__summary-card">
            <div className="inventory-adjustments__summary-icon inventory-adjustments__summary-icon--info">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <span>Posted</span>
              <strong>{postedCount}</strong>
            </div>
          </div>
        </section>

        {/* FILTERS */}

        <section className="inventory-adjustments__filters">
          <div className="inventory-adjustments__search">
            <Search size={16} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search reference, product, SKU or warehouse..."
              aria-label="Search stock adjustments"
            />
          </div>

          <div className="inventory-adjustments__select">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter adjustment status"
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

          {hasFilters && (
            <button
              type="button"
              className="inventory-adjustments__reset"
              onClick={resetFilters}
            >
              Reset
            </button>
          )}
        </section>

        {/* TABLE */}

        <section className="inventory-adjustments__card">
          <div className="inventory-adjustments__card-header">
            <div>
              <span className="inventory-adjustments__eyebrow">
                Adjustment Register
              </span>

              <h2>Adjustment History</h2>
            </div>

            <span className="inventory-adjustments__count">
              {filteredAdjustments.length} records
            </span>
          </div>

          {loading ? (
            <div className="inventory-adjustments__loading">
              Loading adjustments...
            </div>
          ) : filteredAdjustments.length === 0 ? (
            <div className="inventory-adjustments__empty">
              <div className="inventory-adjustments__empty-icon">
                <SlidersHorizontal size={22} />
              </div>

              <h3>No stock adjustments yet</h3>

              <p>
                Inventory corrections will appear here when
                stock is adjusted because of physical counts,
                damage, loss, opening balances, or other
                approved reasons.
              </p>

              <Button
                variant="primary"
                onClick={handleNewAdjustment}
              >
                <Plus size={15} />
                New Adjustment
              </Button>
            </div>
          ) : (
            <div className="inventory-adjustments__table-wrap">
              <table className="inventory-adjustments__table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Warehouse</th>
                    <th>Direction</th>
                    <th>Quantity</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAdjustments.map((adjustment) => {
                    const config =
                      STATUS_CONFIG[adjustment.status] ||
                      STATUS_CONFIG.draft;

                    const Icon = config.icon;

                    const isIncrease =
                      adjustment.direction === "increase";

                    return (
                      <tr key={adjustment.id}>
                        <td>
                          <strong>
                            {adjustment.reference || "—"}
                          </strong>
                        </td>

                        <td>
                          {adjustment.product || "—"}
                        </td>

                        <td>
                          <span className="inventory-adjustments__sku">
                            {adjustment.sku || "—"}
                          </span>
                        </td>

                        <td>
                          {adjustment.warehouse || "—"}
                        </td>

                        <td>
                          <span
                            className={`inventory-adjustments__direction inventory-adjustments__direction--${
                              isIncrease
                                ? "increase"
                                : "decrease"
                            }`}
                          >
                            {isIncrease ? (
                              <ArrowUpFromLine size={13} />
                            ) : (
                              <ArrowDownToLine size={13} />
                            )}

                            {isIncrease
                              ? "Increase"
                              : "Decrease"}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {adjustment.quantity ?? 0}
                          </strong>

                          {adjustment.unit && (
                            <span className="inventory-adjustments__unit">
                              {" "}
                              {adjustment.unit}
                            </span>
                          )}
                        </td>

                        <td>
                          {adjustment.reason || "—"}
                        </td>

                        <td>
                          <span
                            className={`inventory-adjustments__status inventory-adjustments__status--${config.tone}`}
                          >
                            <Icon size={13} />
                            {config.label}
                          </span>
                        </td>

                        <td>
                          {adjustment.createdBy || "—"}
                        </td>

                        <td>
                          {adjustment.createdAt || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ADJUSTMENT RULES */}

        <section className="inventory-adjustments__rules">
          <div className="inventory-adjustments__rules-header">
            <div>
              <span className="inventory-adjustments__eyebrow">
                Control Framework
              </span>

              <h2>Adjustment Controls</h2>
            </div>
          </div>

          <div className="inventory-adjustments__rules-grid">
            <div className="inventory-adjustments__rule">
              <span className="inventory-adjustments__rule-number">
                01
              </span>

              <div>
                <strong>Record the reason</strong>
                <p>
                  Every stock correction must have a
                  defined business reason.
                </p>
              </div>
            </div>

            <div className="inventory-adjustments__rule">
              <span className="inventory-adjustments__rule-number">
                02
              </span>

              <div>
                <strong>Verify physical stock</strong>
                <p>
                  Adjustments should reference an actual
                  count or documented variance.
                </p>
              </div>
            </div>

            <div className="inventory-adjustments__rule">
              <span className="inventory-adjustments__rule-number">
                03
              </span>

              <div>
                <strong>Approval before posting</strong>
                <p>
                  Controlled adjustments can require
                  approval before affecting stock.
                </p>
              </div>
            </div>

            <div className="inventory-adjustments__rule">
              <span className="inventory-adjustments__rule-number">
                04
              </span>

              <div>
                <strong>Keep the audit trail</strong>
                <p>
                  User, timestamp, quantity and reason
                  remain part of the adjustment history.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}