"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./WorkOrders.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "released", label: "Released" },
  { value: "material_pending", label: "Material Pending" },
  { value: "ready", label: "Ready" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    className: "draft",
  },
  released: {
    label: "Released",
    className: "released",
  },
  material_pending: {
    label: "Material Pending",
    className: "material-pending",
  },
  ready: {
    label: "Ready",
    className: "ready",
  },
  in_progress: {
    label: "In Progress",
    className: "in-progress",
  },
  on_hold: {
    label: "On Hold",
    className: "on-hold",
  },
  completed: {
    label: "Completed",
    className: "completed",
  },
  cancelled: {
    label: "Cancelled",
    className: "cancelled",
  },
};

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    className: "critical",
  },
  high: {
    label: "High",
    className: "high",
  },
  medium: {
    label: "Medium",
    className: "medium",
  },
  low: {
    label: "Low",
    className: "low",
  },
};

export default function WorkOrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Backend will replace this array.
   *
   * Expected record shape:
   *
   * {
   *   id,
   *   code,
   *   productionPlan,
   *   productName,
   *   category,
   *   quantity,
   *   startDate,
   *   dueDate,
   *   workCenter,
   *   priority,
   *   status
   * }
   */
  const workOrders = [];

  const filteredWorkOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return workOrders.filter((order) => {
      const matchesSearch =
        !query ||
        [
          order.code,
          order.productionPlan,
          order.productName,
          order.category,
          order.workCenter,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          );

      const matchesStatus =
        status === "all" || order.status === status;

      const matchesPriority =
        priority === "all" ||
        order.priority === priority;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [search, status, priority]);

  const handleRefresh = async () => {
    setRefreshing(true);

    /*
     * API refresh will be implemented during backend phase.
     */

    await new Promise((resolve) =>
      setTimeout(resolve, 350)
    );

    setRefreshing(false);
  };

  const hasFilters =
    search.trim() ||
    status !== "all" ||
    priority !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPriority("all");
  };

  return (
    <div className="production-work-orders-page">
      <PageHeader
        eyebrow="Production"
        title="Work Orders"
        description="Create, release, monitor and manage production work orders."
        action={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              /*
               * Work order creation workflow will be connected later.
               */
            }}
          >
            Create Work Order
          </Button>
        }
      />

      <section className="work-orders-toolbar">
        <div className="work-orders-toolbar__search">
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
            placeholder="Search work orders, products, plans..."
            aria-label="Search work orders"
          />
        </div>

        <div className="work-orders-toolbar__filters">
          <div className="work-orders-filter">
            <SlidersHorizontal
              size={15}
              strokeWidth={1.8}
            />

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
          </div>

          <div className="work-orders-filter">
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value)
              }
              aria-label="Filter by priority"
            >
              {PRIORITY_OPTIONS.map((option) => (
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
            size="md"
            icon={RefreshCw}
            loading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </section>

      <section className="work-orders-summary">
        <div>
          <span className="work-orders-summary__label">
            Work Orders
          </span>

          <strong>
            {filteredWorkOrders.length}
          </strong>

          <span className="work-orders-summary__description">
            {hasFilters
              ? "Matching current filters"
              : "Total available records"}
          </span>
        </div>

        {hasFilters && (
          <button
            type="button"
            className="work-orders-clear"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </section>

      <section className="work-orders-content">
        {filteredWorkOrders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={
              hasFilters
                ? "No matching work orders"
                : "No work orders yet"
            }
            description={
              hasFilters
                ? "Try changing your search or filter criteria."
                : "Production work orders will appear here after they are created."
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
              ) : (
                <Button
                  variant="primary"
                  size="small"
                  icon={Plus}
                  onClick={() => {
                    /*
                     * Work order creation workflow.
                     */
                  }}
                >
                  Create Work Order
                </Button>
              )
            }
          />
        ) : (
          <div className="work-orders-table-wrap">
            <table className="work-orders-table">
              <thead>
                <tr>
                  <th>Work Order</th>
                  <th>Production Plan</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Start Date</th>
                  <th>Due Date</th>
                  <th>Work Center</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredWorkOrders.map((order) => {
                  const statusConfig =
                    STATUS_CONFIG[order.status] || {
                      label: order.status || "—",
                      className: "draft",
                    };

                  const priorityConfig =
                    PRIORITY_CONFIG[order.priority] || {
                      label: order.priority || "—",
                      className: "low",
                    };

                  return (
                    <tr key={order.id || order.code}>
                      <td>
                        <strong>
                          {order.code || "—"}
                        </strong>
                      </td>

                      <td>
                        {order.productionPlan || "—"}
                      </td>

                      <td>
                        {order.productName || "—"}
                      </td>

                      <td>
                        {order.category || "—"}
                      </td>

                      <td>
                        {order.quantity ?? "—"}
                      </td>

                      <td>
                        {order.startDate || "—"}
                      </td>

                      <td>
                        {order.dueDate || "—"}
                      </td>

                      <td>
                        {order.workCenter || "—"}
                      </td>

                      <td>
                        <span
                          className={`work-orders-priority work-orders-priority--${priorityConfig.className}`}
                        >
                          {priorityConfig.label}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`work-orders-status work-orders-status--${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="work-orders-action"
                          aria-label={`Open ${
                            order.code || "work order"
                          }`}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}