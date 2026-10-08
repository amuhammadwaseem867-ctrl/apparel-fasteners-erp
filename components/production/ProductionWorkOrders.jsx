"use client";

import Link from "next/link";
import {
  ClipboardList,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

import "./ProductionWorkOrders.css";

const STATUS_LABELS = {
  draft: "Draft",
  released: "Released",
  material_pending: "Material Pending",
  ready: "Ready",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CLASS = {
  draft: "neutral",
  released: "info",
  material_pending: "warning",
  ready: "info",
  in_progress: "active",
  on_hold: "warning",
  completed: "success",
  cancelled: "danger",
};

export default function ProductionWorkOrders({
  workOrders = [],
  href = "/production/work-orders",
}) {
  return (
    <section className="production-work-orders">
      <div className="production-work-orders__header">
        <div>
          <span className="production-work-orders__eyebrow">
            Production Orders
          </span>

          <h2>Work Orders</h2>

          <p>
            Monitor active and upcoming production work orders.
          </p>
        </div>

        <Link
          href={href}
          className="production-work-orders__view-all"
        >
          View all
          <ArrowRight size={15} />
        </Link>
      </div>

      {workOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No work orders"
          description="Production work orders will appear here once they are created."
          size="small"
          action={
            <Link
              href={href}
              className="production-work-orders__empty-link"
            >
              Open Work Orders
            </Link>
          }
        />
      ) : (
        <div className="production-work-orders__table-wrap">
          <table className="production-work-orders__table">
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Due Date</th>
                <th>Work Center</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {workOrders.map((order) => {
                const status =
                  order.status?.toLowerCase() || "draft";

                return (
                  <tr key={order.id || order.code}>
                    <td>
                      <strong>
                        {order.code || "—"}
                      </strong>
                    </td>

                    <td>
                      {order.productName || "—"}
                    </td>

                    <td>
                      {order.quantity ?? "—"}
                    </td>

                    <td>
                      {order.dueDate || "—"}
                    </td>

                    <td>
                      {order.workCenter || "—"}
                    </td>

                    <td>
                      <span
                        className={`production-work-orders__status production-work-orders__status--${
                          STATUS_CLASS[status] || "neutral"
                        }`}
                      >
                        {STATUS_LABELS[status] ||
                          order.status ||
                          "—"}
                      </span>
                    </td>

                    <td>
                      {order.href ? (
                        <Link
                          href={order.href}
                          className="production-work-orders__open"
                          aria-label={`Open ${order.code || "work order"}`}
                        >
                          <ExternalLink size={15} />
                        </Link>
                      ) : (
                        <span className="production-work-orders__placeholder">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}