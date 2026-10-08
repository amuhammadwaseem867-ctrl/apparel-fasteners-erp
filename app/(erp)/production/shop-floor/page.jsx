"use client";

import { useMemo, useState } from "react";
import {
  Factory,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Play,
  Pause,
  RotateCcw,
  Square,
  Clock3,
  UserRound,
  AlertTriangle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./ShopFloor.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "ready", label: "Ready" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "stopped", label: "Stopped" },
];

const STATUS_CONFIG = {
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
  stopped: {
    label: "Stopped",
    className: "stopped",
  },
};

export default function ShopFloorPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Backend-ready shop floor structure:
   *
   * {
   *   id,
   *   operationId,
   *   workOrder,
   *   productName,
   *   operation,
   *   workCenter,
   *   operator,
   *   shift,
   *   plannedQuantity,
   *   completedQuantity,
   *   rejectedQuantity,
   *   progress,
   *   status,
   *   startedAt,
   *   elapsedMinutes,
   *   downtimeMinutes,
   *   downtimeReason
   * }
   */

  const shopFloorJobs = [];

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return shopFloorJobs.filter((job) => {
      const matchesSearch =
        !query ||
        [
          job.workOrder,
          job.productName,
          job.operation,
          job.workCenter,
          job.operator,
          job.shift,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesStatus =
        status === "all" ||
        job.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  const handleRefresh = async () => {
    setRefreshing(true);

    /*
     * Live shop-floor API / websocket integration
     * will be connected during backend phase.
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
    <div className="shop-floor-page">
      <PageHeader
        eyebrow="Production"
        title="Shop Floor"
        description="Monitor live production execution, operators, work centers, output and downtime."
      />

      <section className="shop-floor-toolbar">
        <div className="shop-floor-toolbar__search">
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
            placeholder="Search work orders, operations, work centers..."
            aria-label="Search shop floor jobs"
          />
        </div>

        <div className="shop-floor-toolbar__controls">
          <div className="shop-floor-filter">
            <SlidersHorizontal
              size={15}
              strokeWidth={1.8}
            />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter shop floor jobs by status"
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

      <section className="shop-floor-summary">
        <SummaryItem
          label="Active Jobs"
          value={filteredJobs.length}
        />

        <SummaryItem
          label="Running"
          value={getCount(
            filteredJobs,
            "running"
          )}
        />

        <SummaryItem
          label="Paused"
          value={getCount(
            filteredJobs,
            "paused"
          )}
        />

        <SummaryItem
          label="Ready"
          value={getCount(
            filteredJobs,
            "ready"
          )}
        />

        <SummaryItem
          label="Stopped"
          value={getCount(
            filteredJobs,
            "stopped"
          )}
        />
      </section>

      <section className="shop-floor-content">
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={Factory}
            title={
              hasFilters
                ? "No matching shop floor jobs"
                : "No active shop floor jobs"
            }
            description={
              hasFilters
                ? "Try changing your search or status filter."
                : "Live production operations will appear here when work reaches the shop floor."
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
          <ShopFloorGrid jobs={filteredJobs} />
        )}
      </section>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="shop-floor-summary__item">
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

function ShopFloorGrid({ jobs }) {
  return (
    <div className="shop-floor-grid">
      {jobs.map((job) => (
        <ShopFloorCard
          key={job.id || job.workOrder}
          job={job}
        />
      ))}
    </div>
  );
}

function ShopFloorCard({ job }) {
  const status =
    STATUS_CONFIG[job.status] || {
      label: job.status || "—",
      className: "ready",
    };

  const progress = Math.max(
    0,
    Math.min(
      100,
      Number(job.progress) || 0
    )
  );

  return (
    <article className="shop-floor-card">
      <div className="shop-floor-card__header">
        <div>
          <span className="shop-floor-card__eyebrow">
            {job.workOrder || "Work Order"}
          </span>

          <h2>
            {job.operation || "Production Operation"}
          </h2>
        </div>

        <span
          className={`shop-floor-status shop-floor-status--${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="shop-floor-card__product">
        {job.productName || "Product —"}
      </div>

      <div className="shop-floor-card__meta">
        <MetaItem
          icon={Factory}
          label="Work Center"
          value={job.workCenter}
        />

        <MetaItem
          icon={UserRound}
          label="Operator"
          value={job.operator}
        />

        <MetaItem
          icon={Clock3}
          label="Shift"
          value={job.shift}
        />
      </div>

      <div className="shop-floor-card__progress">
        <div className="shop-floor-card__progress-top">
          <span>Production Progress</span>
          <strong>{progress}%</strong>
        </div>

        <div className="shop-floor-card__progress-bar">
          <span
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <div className="shop-floor-card__quantities">
        <Quantity
          label="Planned"
          value={job.plannedQuantity}
        />

        <Quantity
          label="Completed"
          value={job.completedQuantity}
        />

        <Quantity
          label="Rejected"
          value={job.rejectedQuantity}
          danger
        />
      </div>

      <div className="shop-floor-card__timing">
        <div>
          <span>Started</span>
          <strong>
            {job.startedAt || "Not started"}
          </strong>
        </div>

        <div>
          <span>Elapsed</span>
          <strong>
            {formatMinutes(job.elapsedMinutes)}
          </strong>
        </div>

        <div>
          <span>Downtime</span>
          <strong>
            {formatMinutes(job.downtimeMinutes)}
          </strong>
        </div>
      </div>

      {job.downtimeReason && (
        <div className="shop-floor-card__downtime">
          <AlertTriangle size={14} />

          <span>
            {job.downtimeReason}
          </span>
        </div>
      )}

      <ShopFloorActions status={job.status} />
    </article>
  );
}

function MetaItem({ icon: Icon, label, value }) {
  return (
    <div className="shop-floor-meta">
      <Icon size={14} strokeWidth={1.8} />

      <div>
        <span>{label}</span>
        <strong>{value || "—"}</strong>
      </div>
    </div>
  );
}

function Quantity({
  label,
  value,
  danger = false,
}) {
  return (
    <div
      className={`shop-floor-quantity ${
        danger
          ? "shop-floor-quantity--danger"
          : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function formatMinutes(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "—";
  }

  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return "—";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining
    ? `${hours}h ${remaining}m`
    : `${hours}h`;
}

function ShopFloorActions({ status }) {
  if (status === "running") {
    return (
      <div className="shop-floor-actions">
        <button
          type="button"
          className="shop-floor-action shop-floor-action--pause"
          aria-label="Pause production"
        >
          <Pause size={15} />
          Pause
        </button>

        <button
          type="button"
          className="shop-floor-action shop-floor-action--stop"
          aria-label="Stop production"
        >
          <Square size={14} />
          Stop
        </button>
      </div>
    );
  }

  if (status === "paused") {
    return (
      <div className="shop-floor-actions">
        <button
          type="button"
          className="shop-floor-action shop-floor-action--primary"
          aria-label="Resume production"
        >
          <RotateCcw size={15} />
          Resume
        </button>

        <button
          type="button"
          className="shop-floor-action shop-floor-action--stop"
          aria-label="Stop production"
        >
          <Square size={14} />
          Stop
        </button>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="shop-floor-actions">
        <button
          type="button"
          className="shop-floor-action shop-floor-action--primary"
          aria-label="Start production"
        >
          <Play size={15} />
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="shop-floor-actions">
      <button
        type="button"
        className="shop-floor-action"
        aria-label="View production job"
      >
        View Details
      </button>
    </div>
  );
}