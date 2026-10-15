"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  FilePen,
  Package,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";

import Alert from "@/components/ui/Alert";
import { apiRequest } from "@/lib/api/client";
import {
  DASHBOARD_PERIODS,
  DEFAULT_DASHBOARD_PERIOD,
  formatAmount,
  formatCount,
  toDashboardView,
} from "@/lib/dashboard/dashboardView";

import "./Dashboard.css";

/*
 * Command Center Dashboard.
 *
 * All values come from GET /api/dashboard
 * (server/dashboard/dashboard.service.ts). Only KPIs the API returns are
 * shown; modules the API reports as not connected are listed instead of
 * being displayed as zero.
 */

function StatCard({ icon: Icon, label, value, note, tone }) {
  return (
    <article
      className={`dashboard__stat${tone ? ` dashboard__stat--${tone}` : ""}`}
    >
      <div className="dashboard__stat-top">
        <div className="dashboard__stat-icon">
          <Icon size={18} />
        </div>
      </div>

      <div className="dashboard__stat-value">{value}</div>

      <div className="dashboard__stat-label">{label}</div>

      {note && <div className="dashboard__stat-note">{note}</div>}
    </article>
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
}

export default function DashboardPage() {
  const [period, setPeriod] = useState(DEFAULT_DASHBOARD_PERIOD);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const value = await apiRequest(
          `/api/dashboard?period=${encodeURIComponent(period)}`,
        );

        if (active) {
          setData(value);
        }
      } catch (cause) {
        if (active) {
          setError(cause?.message || "Unable to load the dashboard.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [period, refresh]);

  const view = data ? toDashboardView(data) : null;
  const kpis = view?.kpis;

  return (
    <div className="dashboard">
      <section className="dashboard__header">
        <div>
          <span className="dashboard__kicker">Operational overview</span>

          <h2>Command Center</h2>

          <p>
            Sales orders, customers, products and inventory from the ERP database.
            {view?.period &&
              ` Period: ${view.period.dateFrom} to ${view.period.dateTo}.`}
          </p>
        </div>

        <div className="dashboard__header-actions">
          <label className="dashboard__date">
            <Clock3 size={16} />

            <span className="dashboard__sr-only">Period</span>

            <select
              className="dashboard__period-select"
              value={period}
              disabled={loading}
              onChange={(event) => setPeriod(event.target.value)}
            >
              {DASHBOARD_PERIODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="dashboard__date"
            disabled={loading}
            onClick={() => setRefresh((current) => current + 1)}
          >
            <RefreshCw size={16} />

            <span>{loading ? "Loading..." : "Refresh"}</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="dashboard__message">
          <Alert
            variant="danger"
            title="Dashboard could not be loaded"
            action={{
              label: "Try again",
              onClick: () => setRefresh((current) => current + 1),
            }}
          >
            {error}
          </Alert>
        </div>
      )}

      {loading && !view && (
        <section
          className="dashboard__stats"
          aria-busy="true"
          aria-label="Loading dashboard"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <article
              className="dashboard__stat dashboard__stat--loading"
              key={index}
            >
              <div className="dashboard__skeleton dashboard__skeleton--icon" />
              <div className="dashboard__skeleton dashboard__skeleton--value" />
              <div className="dashboard__skeleton dashboard__skeleton--label" />
            </article>
          ))}
        </section>
      )}

      {view && (
        <>
          {view.isEmpty && (
            <div className="dashboard__message">
              <Alert variant="info" title="No sales activity in this period">
                No sales orders were placed in the selected period and no
                recent activity is recorded. Choose a longer period or{" "}
                <Link href="/sales/orders/new">create a sales order</Link>.
              </Alert>
            </div>
          )}

          <section
            className="dashboard__stats"
            aria-busy={loading}
          >
            <StatCard
              icon={ShoppingCart}
              label="Sales Orders"
              value={formatCount(kpis.totalOrders)}
              note="placed in period, all statuses"
            />

            <StatCard
              icon={CheckCircle2}
              label="Approved Order Value"
              value={formatAmount(kpis.approvedSales)}
              note={`${formatCount(kpis.approvedOrders)} approved orders`}
            />

            <StatCard
              icon={FilePen}
              label="Draft Order Value"
              value={formatAmount(kpis.draftSales)}
              note={`${formatCount(kpis.draftOrders)} draft orders`}
            />

            <StatCard
              icon={Ban}
              label="Cancelled Order Value"
              value={formatAmount(kpis.cancelledSales)}
              note={`${formatCount(kpis.cancelledOrders)} cancelled orders`}
            />
          </section>

          <section className="dashboard__stats">
            <StatCard
              icon={AlertTriangle}
              label="Overdue Draft Orders"
              value={formatCount(kpis.overdueOrders)}
              note="placed in period, delivery date passed"
              tone="warning"
            />

            <StatCard
              icon={Clock3}
              label="Orders Due Soon"
              value={formatCount(kpis.dueSoonOrders)}
              note="placed in period, due within 7 days"
              tone="info"
            />

            <StatCard
              icon={Users}
              label="Active Customers"
              value={formatCount(kpis.activeCustomers)}
              note="customer master, status active"
            />

            <StatCard
              icon={Package}
              label="Products"
              value={formatCount(kpis.activeProducts)}
              note="product master, not archived"
            />
          </section>

          <div className="dashboard__grid dashboard__grid--bottom">
            <section className="dashboard__panel">
              <div className="dashboard__panel-header">
                <div>
                  <span className="dashboard__panel-kicker">Sales</span>

                  <h3>Recent Sales Orders</h3>
                </div>

                <Link className="dashboard__text-button" href="/sales/orders">
                  View all
                </Link>
              </div>

              {view.recentOrders.length ? (
                <div className="dashboard__table-wrap">
                  <table className="dashboard__table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Order date</th>
                        <th>Delivery</th>
                        <th>Status</th>
                        <th className="dashboard__num">Lines</th>
                        <th className="dashboard__num">Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {view.recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <Link href={`/sales/orders/${encodeURIComponent(order.id)}`}>
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td>{order.customerName}</td>
                          <td>{formatDate(order.orderDate)}</td>
                          <td>{formatDate(order.deliveryDate)}</td>
                          <td>
                            <span
                              className={`dashboard__status dashboard__status--${String(order.status).toLowerCase()}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="dashboard__num">
                            {formatCount(order.items)}
                          </td>
                          <td className="dashboard__num">
                            {formatAmount(order.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dashboard__panel-empty">
                  No sales orders have been created yet.
                </p>
              )}
            </section>

            <section className="dashboard__panel">
              <div className="dashboard__panel-header">
                <div>
                  <span className="dashboard__panel-kicker">Sales</span>

                  <h3>Orders by Status</h3>
                </div>
              </div>

              {view.orderStatus.length ? (
                <div className="dashboard__table-wrap">
                  <table className="dashboard__table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th className="dashboard__num">Orders</th>
                        <th className="dashboard__num">Value</th>
                      </tr>
                    </thead>

                    <tbody>
                      {view.orderStatus.map((row) => (
                        <tr key={row.status}>
                          <td>{row.status}</td>
                          <td className="dashboard__num">
                            {formatCount(row.count)}
                          </td>
                          <td className="dashboard__num">
                            {formatAmount(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dashboard__panel-empty">
                  No status breakdown returned for this period.
                </p>
              )}
            </section>
          </div>

          <section className="dashboard__panel">
            <div className="dashboard__panel-header">
              <div>
                <span className="dashboard__panel-kicker">Audit trail</span>

                <h3>Recent Activity</h3>
              </div>
            </div>

            {view.activity.length ? (
              <div className="dashboard__activity">
                {view.activity.map((entry) => (
                  <div className="dashboard__activity-item" key={entry.id}>
                    <span className="dashboard__activity-dot" />

                    <div className="dashboard__activity-content">
                      <strong>{entry.action}</strong>

                      <span>
                        {entry.entityType}
                        {entry.entityId ? ` · ${entry.entityId}` : ""}
                      </span>
                    </div>

                    <time dateTime={entry.createdAt}>
                      {formatDateTime(entry.createdAt)}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard__panel-empty">
                No audit activity has been recorded yet.
              </p>
            )}
          </section>

          {view.inventory && (
            <section className="dashboard__panel">
              <div className="dashboard__panel-header">
                <div>
                  <span className="dashboard__panel-kicker">Inventory</span>
                  <h3>Stock Position</h3>
                </div>
                <Link className="dashboard__text-button" href="/inventory">Open inventory</Link>
              </div>
              <div className="dashboard__stats" style={{ padding: 18, marginBottom: 0 }}>
                <StatCard icon={Package} label="Items with stock records" value={formatCount(view.inventory.trackedItemCount)} note={`${formatCount(view.inventory.itemCount)} items in master`} />
                <StatCard icon={AlertTriangle} label="Low stock" value={formatCount(view.inventory.lowStockCount)} note="available below minimum" tone="warning" />
                <StatCard icon={Ban} label="Out of stock" value={formatCount(view.inventory.outOfStockCount)} note="nothing available" tone="danger" />
              </div>
              {view.inventory.totalsByUnit.length ? (
                <div className="dashboard__table-wrap">
                  <table className="dashboard__table">
                    <thead><tr><th>Unit</th><th className="dashboard__num">On hand</th><th className="dashboard__num">Reserved</th><th className="dashboard__num">QC hold</th><th className="dashboard__num">Available</th></tr></thead>
                    <tbody>
                      {view.inventory.totalsByUnit.map((total) => (
                        <tr key={total.unit}>
                          <td>{total.unit}</td>
                          <td className="dashboard__num">{total.onHand}</td>
                          <td className="dashboard__num">{total.reserved}</td>
                          <td className="dashboard__num">{total.qualityHold}</td>
                          <td className="dashboard__num">{total.available}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dashboard__panel-empty">No stock has been posted yet.</p>
              )}
            </section>
          )}

          {Object.keys(view.operations).length > 0 && (
            <section className="dashboard__panel">
              <div className="dashboard__panel-header">
                <div>
                  <span className="dashboard__panel-kicker">Operations</span>
                  <h3>Production, quality, dispatch and receivables</h3>
                </div>
                <Link className="dashboard__text-button" href="/reports">Reports</Link>
              </div>
              <div className="dashboard__stats" style={{ padding: 18, marginBottom: 0 }}>
                {view.operations.production && <>
                  <StatCard icon={Clock3} label="Production in progress" value={formatCount(view.operations.production.active)} note={`${view.operations.production.onHold} on hold · ${view.operations.production.completed} completed in period`} />
                  <StatCard icon={AlertTriangle} label="Production overdue" value={formatCount(view.operations.production.overdue)} note="open orders past due date" tone={view.operations.production.overdue ? "danger" : undefined} />
                </>}
                {view.operations.quality && (
                  <StatCard icon={CheckCircle2} label="Inspections awaiting approval" value={formatCount(view.operations.quality.open)} note={view.operations.quality.finalPassRate ? `final pass rate ${view.operations.quality.finalPassRate}% in period` : "no final inspections in period"} />
                )}
                {view.operations.dispatch && <>
                  <StatCard icon={Package} label="Packed, ready to ship" value={formatCount(view.operations.dispatch.readyToShip)} note={`${view.operations.dispatch.drafts} draft shipments`} />
                  <StatCard icon={ShoppingCart} label="In transit" value={formatCount(view.operations.dispatch.inTransit)} note={`${view.operations.dispatch.delivered} delivered in period`} />
                </>}
                {view.operations.finance && (
                  <StatCard icon={FilePen} label="Receivable" value={formatAmount(view.operations.finance.receivable)} note={`overdue ${formatAmount(view.operations.finance.overdue)} · received ${formatAmount(view.operations.finance.received)} in period`} tone={Number(view.operations.finance.overdue) > 0 ? "warning" : undefined} />
                )}
              </div>
            </section>
          )}

          {view.unavailableModules.length > 0 && (
            <div className="dashboard__message">
              <Alert variant="neutral" title="Not yet reported by the backend">
                {view.unavailableModules.join(", ")} KPIs are not available
                from the dashboard API yet, so they are not shown. They will
                appear here once those modules are built.
              </Alert>
            </div>
          )}
        </>
      )}
    </div>
  );
}
