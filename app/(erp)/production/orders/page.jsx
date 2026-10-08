"use client";

import Link from "next/link";
import {
  Eye,
  Factory,
  Filter,
  Plus,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import useOrderStore from "@/lib/useOrderStore";
import { PRODUCTION_STAGES } from "@/config/production";
import { ORDER_STATUSES } from "@/config/orders";

import "./ProductionOrders.css";

/*
 * Production Orders — confirmed sales orders released to the
 * factory. Derived from the shared order store, filtered to
 * production-relevant statuses.
 */

const PRODUCTION_STATUSES = ["confirmed", "in-production", "on-hold", "qc-pending", "qc-approved", "packing"];

export default function ProductionOrdersPage() {
  const { orders, stageProgress } = useOrderStore([]);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const productionOrders = orders.filter((order) => {
    if (!PRODUCTION_STATUSES.includes(order.status)) return false;

    if (stageFilter !== "all" && order.currentStage !== stageFilter) return false;

    if (statusFilter !== "all" && order.status !== statusFilter) return false;

    if (search.trim()) {
      const value = search.trim().toLowerCase();

      const searchable = [
        order.orderNumber,
        order.customerName,
        order.zipperType,
        order.currentStage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(value)) return false;
    }

    return true;
  });

  const stageLabel = (key) =>
    PRODUCTION_STAGES.find((stage) => stage.key === key)?.label || "—";

  const hasFilters =
    search.trim() || stageFilter !== "all" || statusFilter !== "all";

  return (
    <main className="prod-orders">
      <PageHeader
        eyebrow="Factory Operations / Production"
        title="Production Orders"
        description="Confirmed orders released to the factory floor. Start and manage stages, track quantities and completion."
        action={
          <Link href="/sales/orders/new">
            <Button variant="primary" icon={Plus}>
              New Order
            </Button>
          </Link>
        }
      />

      <div className="prod-orders__content">
        <section className="prod-orders__toolbar">
          <div className="prod-orders__search">
            <Input
              placeholder="Search by order number, customer, product, stage..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="prod-orders__filters">
            <Select
              value={stageFilter}
              onChange={setStageFilter}
              options={[
                { value: "all", label: "All Stages" },
                ...PRODUCTION_STAGES.map((stage) => ({
                  value: stage.key,
                  label: stage.label,
                })),
              ]}
              fullWidth={false}
            />

            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                ...ORDER_STATUSES.filter((status) =>
                  PRODUCTION_STATUSES.includes(status.id)
                ).map((status) => ({
                  value: status.id,
                  label: status.label,
                })),
              ]}
              fullWidth={false}
            />

            {hasFilters && (
              <Button
                variant="secondary"
                icon={Filter}
                onClick={() => {
                  setSearch("");
                  setStageFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </section>

        <section className="prod-orders__list-card">
          {productionOrders.length === 0 ? (
            <EmptyState
              icon={Factory}
              title={
                hasFilters
                  ? "No matching production orders"
                  : orders.length === 0
                    ? "No production orders yet"
                    : "No orders in production"
              }
              description={
                hasFilters
                  ? "No orders match the current filters."
                  : orders.length === 0
                    ? "Create a customer order and confirm it to release it to production."
                    : "Confirmed orders in production, on hold, QC or packing appear here."
              }
              action={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setStageFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : (
                  <Link href="/sales/orders/new">
                    <Button variant="primary" icon={Plus}>
                      New Order
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="prod-orders__table-wrap">
              <table className="prod-orders__table">
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Current Stage</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {productionOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/sales/orders/${order.id}`}
                          className="prod-orders__order-link"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>

                      <td>{order.customerName || "—"}</td>

                      <td>
                        {[
                          order.zipperType,
                          order.zipperSize,
                          order.colorFinish,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>

                      <td>
                        {order.requiredQuantity.toLocaleString()}{" "}
                        {order.unit}
                      </td>

                      <td>{stageLabel(order.currentStage)}</td>

                      <td>
                        <div className="prod-orders__progress">
                          <div className="prod-orders__progress-track">
                            <div
                              className="prod-orders__progress-value"
                              style={{
                                width: `${stageProgress(order)}%`,
                              }}
                            />
                          </div>

                          <span>{stageProgress(order)}%</span>
                        </div>
                      </td>

                      <td>
                        <Badge
                          variant={
                            order.status === "on-hold"
                              ? "warning"
                              : "info"
                          }
                        >
                          {ORDER_STATUSES.find((s) => s.id === order.status)
                            ?.label || order.status}
                        </Badge>
                      </td>

                      <td>
                        <Link href={`/sales/orders/${order.id}`}>
                          <Button
                            variant="secondary"
                            size="icon"
                            icon={Eye}
                            aria-label="View order"
                          />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="prod-orders__flow">
          <div className="prod-orders__section-heading">
            <div>
              <h2>Factory Production Flow</h2>

              <p>
                Every production order follows these nine stages in
                sequence. Stages are managed on the Stage Board and
                the Order Profile.
              </p>
            </div>
          </div>

          <div className="prod-orders__flow-track">
            {PRODUCTION_STAGES.map((stage, index) => (
              <div className="prod-orders__flow-step" key={stage.key}>
                <span>{String(stage.sequence).padStart(2, "0")}</span>

                <strong>{stage.label}</strong>

                <small>{stage.department}</small>

                {index < PRODUCTION_STAGES.length - 1 && (
                  <div className="prod-orders__flow-line" />
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
