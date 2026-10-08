"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ClipboardList,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Search,
  RefreshCw,
  Download,
  Plus,
  ArrowRight,
  AlertTriangle,
  Warehouse,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card, { StatCard } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

import "./StockCounts.css";

/*
  Backend-ready data source.
  Keep this empty until the inventory API / Prisma layer is connected.
*/
const countSessions = [];

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    className: "status--draft",
  },
  "in-progress": {
    label: "In Progress",
    className: "status--progress",
  },
  "pending-review": {
    label: "Pending Review",
    className: "status--review",
  },
  approved: {
    label: "Approved",
    className: "status--approved",
  },
  posted: {
    label: "Posted",
    className: "status--posted",
  },
  cancelled: {
    label: "Cancelled",
    className: "status--cancelled",
  },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "pending-review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function getVarianceClass(value) {
  const variance = Number(value || 0);

  if (variance > 0) return "variance--positive";
  if (variance < 0) return "variance--negative";

  return "variance--zero";
}

function getVarianceLabel(value) {
  const variance = Number(value || 0);

  if (variance > 0) return `+${formatNumber(variance)}`;
  if (variance < 0) return formatNumber(variance);

  return "0";
}

export default function StockCountsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [warehouse, setWarehouse] = useState("all");
  const [loading, setLoading] = useState(false);

  const warehouses = useMemo(() => {
    const values = countSessions
      .map((item) => item.warehouse)
      .filter(Boolean);

    return [...new Set(values)];
  }, []);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return countSessions.filter((session) => {
      const matchesSearch =
        !query ||
        [
          session.reference,
          session.warehouse,
          session.countedBy,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );

      const matchesStatus =
        status === "all" || session.status === status;

      const matchesWarehouse =
        warehouse === "all" ||
        session.warehouse === warehouse;

      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [search, status, warehouse]);

  const summary = useMemo(() => {
    return {
      total: countSessions.length,
      inProgress: countSessions.filter(
        (item) => item.status === "in-progress"
      ).length,
      pendingReview: countSessions.filter(
        (item) => item.status === "pending-review"
      ).length,
      approved: countSessions.filter(
        (item) => item.status === "approved"
      ).length,
      posted: countSessions.filter(
        (item) => item.status === "posted"
      ).length,
      variance: countSessions.reduce(
        (total, item) => total + Number(item.variance || 0),
        0
      ),
    };
  }, []);

  function handleRefresh() {
    setLoading(true);

    /*
      Replace this with the inventory API request later.
    */
    window.setTimeout(() => {
      setLoading(false);
    }, 400);
  }

  function handleExport() {
    if (!countSessions.length) return;

    /* Backend integration pending. */
  }

  function handleCreateCount() {
    /*
      Future route:
      /inventory/stock-counts/new
    */
    /* Backend integration pending. */
  }

  function handleRowClick(session) {
    if (!session?.id) return;

    /*
      Future route:
      /inventory/stock-counts/[id]
    */
    /* Backend integration pending. */
  }

  return (
    <main className="stock-counts-page">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Counts"
        description="Plan, record, reconcile and post physical inventory counts."
        action={
          <div className="stock-counts-header-actions">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "is-spinning" : ""}
              />
              Refresh
            </Button>

            <Button
              variant="primary"
              onClick={handleCreateCount}
            >
              <Plus size={16} />
              New Stock Count
            </Button>
          </div>
        }
      />

      <section className="stock-counts-stats">
        <StatCard
          label="Total Sessions"
          value={formatNumber(summary.total)}
          description="All count sessions"
          icon={ClipboardList}
        />

        <StatCard
          label="In Progress"
          value={formatNumber(summary.inProgress)}
          description="Currently being counted"
          icon={Clock3}
        />

        <StatCard
          label="Pending Review"
          value={formatNumber(summary.pendingReview)}
          description="Awaiting reconciliation"
          icon={FileCheck2}
        />

        <StatCard
          label="Approved"
          value={formatNumber(summary.approved)}
          description="Approved for posting"
          icon={CheckCircle2}
        />

        <StatCard
          label="Posted"
          value={formatNumber(summary.posted)}
          description="Applied to inventory"
          icon={ClipboardCheck}
        />

        <StatCard
          label="Total Variance"
          value={getVarianceLabel(summary.variance)}
          description="Across count sessions"
          icon={AlertTriangle}
        />
      </section>

      <Card className="stock-counts-card">
        <div className="stock-counts-toolbar">
          <div className="stock-counts-search">
            <Search size={17} />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, warehouse or counter..."
              aria-label="Search stock counts"
            />
          </div>

          <div className="stock-counts-filters">
            <select
              value={warehouse}
              onChange={(event) =>
                setWarehouse(event.target.value)
              }
              aria-label="Filter by warehouse"
            >
              <option value="all">All Warehouses</option>

              {warehouses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter by status"
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

            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={!countSessions.length}
            >
              <Download size={16} />
              Export
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="stock-counts-loading">
            <div className="stock-counts-loading__row" />
            <div className="stock-counts-loading__row" />
            <div className="stock-counts-loading__row" />
            <div className="stock-counts-loading__row" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No stock counts yet"
            description="Create a stock count session to begin physical inventory verification."
            action={
              <Button
                variant="primary"
                onClick={handleCreateCount}
              >
                <Plus size={16} />
                New Stock Count
              </Button>
            }
          />
        ) : (
          <div className="stock-counts-table-wrap">
            <table className="stock-counts-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Warehouse</th>
                  <th>Items</th>
                  <th>Expected Qty</th>
                  <th>Counted Qty</th>
                  <th>Variance</th>
                  <th>Counted By</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredSessions.map((session) => {
                  const statusConfig =
                    STATUS_CONFIG[session.status] ||
                    STATUS_CONFIG.draft;

                  return (
                    <tr
                      key={session.id}
                      onClick={() =>
                        handleRowClick(session)
                      }
                    >
                      <td>
                        <span className="stock-counts-reference">
                          {session.reference || "—"}
                        </span>
                      </td>

                      <td>
                        <div className="stock-counts-warehouse">
                          <Warehouse size={15} />
                          <span>
                            {session.warehouse || "—"}
                          </span>
                        </div>
                      </td>

                      <td>
                        {formatNumber(session.items)}
                      </td>

                      <td>
                        {formatNumber(session.expectedQty)}
                      </td>

                      <td>
                        {formatNumber(session.countedQty)}
                      </td>

                      <td>
                        <span
                          className={`stock-counts-variance ${getVarianceClass(
                            session.variance
                          )}`}
                        >
                          {getVarianceLabel(session.variance)}
                        </span>
                      </td>

                      <td>
                        {session.countedBy || "—"}
                      </td>

                      <td>
                        <span
                          className={`stock-counts-status ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>

                      <td>
                        {session.date || "—"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="stock-counts-row-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRowClick(session);
                          }}
                          aria-label={`Open ${
                            session.reference || "stock count"
                          }`}
                        >
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="stock-counts-bottom-grid">
        <Card
          title="Stock Count Workflow"
          description="Inventory is changed only after an approved count is posted."
        >
          <div className="stock-counts-workflow">
            <div className="stock-counts-step">
              <span className="stock-counts-step__number">
                01
              </span>

              <div>
                <strong>Plan</strong>
                <span>Create the count session and select the warehouse.</span>
              </div>
            </div>

            <div className="stock-counts-step">
              <span className="stock-counts-step__number">
                02
              </span>

              <div>
                <strong>Count</strong>
                <span>Record physical quantities against system stock.</span>
              </div>
            </div>

            <div className="stock-counts-step">
              <span className="stock-counts-step__number">
                03
              </span>

              <div>
                <strong>Reconcile</strong>
                <span>Review differences and investigate variances.</span>
              </div>
            </div>

            <div className="stock-counts-step">
              <span className="stock-counts-step__number">
                04
              </span>

              <div>
                <strong>Approve</strong>
                <span>Authorize the final count adjustment.</span>
              </div>
            </div>

            <div className="stock-counts-step">
              <span className="stock-counts-step__number">
                05
              </span>

              <div>
                <strong>Post</strong>
                <span>Create the adjustment movement and update stock.</span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Variance Control"
          description="Key rules for reliable physical inventory reconciliation."
        >
          <div className="stock-counts-rules">
            <div className="stock-counts-rule">
              <CheckCircle2 size={17} />
              <div>
                <strong>System quantity stays unchanged</strong>
                <span>
                  Counting alone must never alter available stock.
                </span>
              </div>
            </div>

            <div className="stock-counts-rule">
              <AlertTriangle size={17} />
              <div>
                <strong>Variance requires review</strong>
                <span>
                  Differences should be investigated before approval.
                </span>
              </div>
            </div>

            <div className="stock-counts-rule">
              <ClipboardCheck size={17} />
              <div>
                <strong>Posting creates an adjustment</strong>
                <span>
                  Approved variance becomes an inventory movement.
                </span>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}