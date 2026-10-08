"use client";

import { useMemo, useState } from "react";
import {
  Play,
  RefreshCw,
  Search,
  Eye,
  RotateCcw,
  Clock3,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./MRPRuns.css";

const STATUS_CONFIG = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "success",
  },
  running: {
    label: "Running",
    icon: Clock3,
    className: "info",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    className: "danger",
  },
  pending: {
    label: "Pending",
    icon: Clock3,
    className: "warning",
  },
};

export default function MRPRunsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  /*
   * Backend integration point.
   *
   * Later this will come from the MRP run service/API.
   * No mock runs are intentionally included.
   */
  const runs = useMemo(() => [], []);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const searchableText = [
        run.reference,
        run.name,
        run.createdBy,
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
        run.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [runs, search, status]);

  const handleRunMRP = () => {
    /*
     * MRP execution will be connected to backend here.
     */
  };

  const handleRefresh = () => {
    /*
     * API refresh will be implemented here.
     */
  };

  const handleView = (run) => {
    /*
     * Navigate to MRP run detail later.
     */
    /* Backend integration pending. */
  };

  const handleRerun = (run) => {
    /*
     * Re-run MRP logic will be connected later.
     */
    /* Backend integration pending. */
  };

  return (
    <main className="mrp-runs">
      <PageHeader
        eyebrow="PLANNING / MRP RUNS"
        title="MRP Runs"
        description="Execute and review material requirements planning runs generated from current demand and supply data."
        action={
          <div className="mrp-runs__header-actions">
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCw}
              onClick={handleRefresh}
            >
              Refresh
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={Play}
              onClick={handleRunMRP}
            >
              Run MRP
            </Button>
          </div>
        }
      />

      <div className="mrp-runs__content">
        <section className="mrp-runs__toolbar">
          <div className="mrp-runs__search">
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
              placeholder="Search run, reference or user..."
              aria-label="Search MRP runs"
            />
          </div>

          <div className="mrp-runs__filters">
            <label htmlFor="mrp-status">
              Status
            </label>

            <select
              id="mrp-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="all">All statuses</option>
              <option value="completed">
                Completed
              </option>
              <option value="running">
                Running
              </option>
              <option value="pending">
                Pending
              </option>
              <option value="failed">
                Failed
              </option>
            </select>
          </div>
        </section>

        <section className="mrp-runs__table-card">
          <div className="mrp-runs__table-header">
            <div>
              <h2>MRP Run History</h2>

              <p>
                {runs.length} run
                {runs.length === 1 ? "" : "s"} available
              </p>
            </div>

            <div className="mrp-runs__summary">
              <span>
                Last run: —
              </span>

              <span>
                Requirements: —
              </span>

              <span>
                Shortages: —
              </span>
            </div>
          </div>

          {filteredRuns.length > 0 ? (
            <div className="mrp-runs__table-wrap">
              <table className="mrp-runs__table">
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Run Type</th>
                    <th>Created By</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Requirements</th>
                    <th>Shortages</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRuns.map((run) => {
                    const statusConfig =
                      STATUS_CONFIG[run.status] ||
                      STATUS_CONFIG.pending;

                    const StatusIcon =
                      statusConfig.icon;

                    return (
                      <tr key={run.id}>
                        <td>
                          <div className="mrp-runs__run">
                            <strong>
                              {run.reference || "—"}
                            </strong>

                            <span>
                              {run.name ||
                                "MRP Run"}
                            </span>
                          </div>
                        </td>

                        <td>
                          {run.runType || "—"}
                        </td>

                        <td>
                          {run.createdBy || "—"}
                        </td>

                        <td>
                          {run.startedAt || "—"}
                        </td>

                        <td>
                          {run.duration || "—"}
                        </td>

                        <td>
                          {run.requirementsCount ??
                            "—"}
                        </td>

                        <td>
                          {run.shortagesCount ?? "—"}
                        </td>

                        <td>
                          <span
                            className={`mrp-runs__status mrp-runs__status--${statusConfig.className}`}
                          >
                            <StatusIcon
                              size={13}
                              strokeWidth={1.9}
                              aria-hidden="true"
                            />

                            {statusConfig.label}
                          </span>
                        </td>

                        <td>
                          <div className="mrp-runs__actions">
                            <Button
                              variant="ghost"
                              size="small"
                              icon={Eye}
                              onClick={() =>
                                handleView(run)
                              }
                              aria-label={`View ${run.reference}`}
                            >
                              View
                            </Button>

                            {run.status ===
                              "completed" && (
                              <Button
                                variant="ghost"
                                size="small"
                                icon={RotateCcw}
                                onClick={() =>
                                  handleRerun(run)
                                }
                                aria-label={`Re-run ${run.reference}`}
                              >
                                Re-run
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Play}
              title="No MRP runs"
              description={
                search || status !== "all"
                  ? "No MRP runs match the selected filters."
                  : "MRP runs will appear here after material requirements planning is executed."
              }
              action={
                !search && status === "all" ? (
                  <Button
                    variant="primary"
                    size="md"
                    icon={Play}
                    onClick={handleRunMRP}
                  >
                    Run MRP
                  </Button>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}