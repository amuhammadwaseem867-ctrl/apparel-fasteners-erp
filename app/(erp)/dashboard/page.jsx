"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  FilePen,
  Package,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";

import Alert from "@/components/ui/Alert";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
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

/*
 * Counts a formatted number up from zero once, by writing the DOM text
 * directly (no re-render). The rendered text is always the exact value,
 * so without JavaScript, with reduced motion, or after the animation the
 * figure shown is the API's.
 */
function AnimatedValue({ text }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const match = /^(-?)([\d,]+)(?:\.(\d+))?$/.exec(String(text));
    if (!element || !match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const decimals = match[3]?.length ?? 0;
    const target = Number(`${match[1]}${match[2].replace(/,/g, "")}.${match[3] ?? "0"}`);
    if (!Number.isFinite(target) || target === 0) return undefined;
    const format = (value) => value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const started = performance.now();
    let frame = 0;
    const step = (now) => {
      const progress = Math.min(1, (now - started) / 1100);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = progress < 1 ? format(target * eased) : text;
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = text;
    };
  }, [text]);

  return <span ref={ref}>{text}</span>;
}

/* Moves the card's light with the pointer through CSS variables. */
function trackPointer(event) {
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${event.clientX - box.left}px`);
  card.style.setProperty("--my", `${event.clientY - box.top}px`);
}

function StatCard({ icon: Icon, label, value, note, tone, index = 0 }) {
  return (
    <article
      className={`dashboard__stat dash-rise${tone ? ` dashboard__stat--${tone}` : ""}`}
      style={{ "--d": `${120 + index * 70}ms` }}
      onPointerMove={trackPointer}
    >
      <div className="dashboard__stat-top">
        <div className="dashboard__stat-icon">
          <Icon size={18} />
        </div>
      </div>

      <div className="dashboard__stat-value"><AnimatedValue text={value} /></div>

      <div className="dashboard__stat-label">{label}</div>

      {note && <div className="dashboard__stat-note">{note}</div>}
    </article>
  );
}

const STATUS_TONE = { APPROVED: "good", DRAFT: "warning", CANCELLED: "critical" };

/* Order value by status as labelled bars; the text carries every number. */
function StatusBars({ rows }) {
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  return (
    <ul className="dashboard__bars">
      {rows.map((row, index) => {
        const share = total > 0 ? ((row.amount ?? 0) / total) * 100 : 0;
        return (
          <li
            key={row.status}
            className="dashboard__bar-row"
            title={`${row.status}: ${formatCount(row.count)} orders, ${formatAmount(row.amount)} (${share.toFixed(1)}% of value)`}
          >
            <div className="dashboard__bar-head">
              <span className={`dashboard__status dashboard__status--${String(row.status).toLowerCase()}`}>{row.status}</span>
              <span className="dashboard__bar-figures">
                <strong>{formatAmount(row.amount)}</strong>
                <small>{formatCount(row.count)} orders · {share.toFixed(1)}%</small>
              </span>
            </div>
            <div className="dashboard__bar-track">
              <span
                className={`dashboard__bar-fill dashboard__bar-fill--${STATUS_TONE[row.status] ?? "neutral"}`}
                style={{ "--w": `${Math.max(share, row.amount ? 1.5 : 0)}%`, "--d": `${300 + index * 120}ms` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
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
  const { user } = useCurrentUser();

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
      <section className="dashboard__hero dash-rise" style={{ "--d": "0ms" }}>
        <div className="dashboard__hero-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="dashboard__hero-text">
          <span className="dashboard__kicker">
            <Sparkles size={13} /> Operational overview
          </span>

          <h2>
            {greeting()}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>

          <p>
            Your command center for sales, inventory and operations, straight from the ERP database.
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
            className={`dashboard__date dashboard__refresh${loading ? " dashboard__refresh--spinning" : ""}`}
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
              index={0}
              label="Sales Orders"
              value={formatCount(kpis.totalOrders)}
              note="placed in period, all statuses"
            />

            <StatCard
              icon={CheckCircle2}
              index={1}
              label="Approved Order Value"
              value={formatAmount(kpis.approvedSales)}
              note={`${formatCount(kpis.approvedOrders)} approved orders`}
            />

            <StatCard
              icon={FilePen}
              index={2}
              label="Draft Order Value"
              value={formatAmount(kpis.draftSales)}
              note={`${formatCount(kpis.draftOrders)} draft orders`}
            />

            <StatCard
              icon={Ban}
              index={3}
              label="Cancelled Order Value"
              value={formatAmount(kpis.cancelledSales)}
              note={`${formatCount(kpis.cancelledOrders)} cancelled orders`}
            />
          </section>

          <section className="dashboard__stats">
            <StatCard
              icon={AlertTriangle}
              index={0}
              label="Overdue Draft Orders"
              value={formatCount(kpis.overdueOrders)}
              note="placed in period, delivery date passed"
              tone="warning"
            />

            <StatCard
              icon={Clock3}
              index={1}
              label="Orders Due Soon"
              value={formatCount(kpis.dueSoonOrders)}
              note="placed in period, due within 7 days"
              tone="info"
            />

            <StatCard
              icon={Users}
              index={2}
              label="Active Customers"
              value={formatCount(kpis.activeCustomers)}
              note="customer master, status active"
            />

            <StatCard
              icon={Package}
              index={3}
              label="Products"
              value={formatCount(kpis.activeProducts)}
              note="product master, not archived"
            />
          </section>

          <div className="dashboard__grid dashboard__grid--bottom">
            <section className="dashboard__panel dash-rise">
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

            <section className="dashboard__panel dash-rise">
              <div className="dashboard__panel-header">
                <div>
                  <span className="dashboard__panel-kicker">Sales</span>

                  <h3>Orders by Status</h3>
                </div>
              </div>

              {view.orderStatus.length ? (
                <StatusBars rows={view.orderStatus} />
              ) : (
                <p className="dashboard__panel-empty">
                  No status breakdown returned for this period.
                </p>
              )}
            </section>
          </div>

          <section className="dashboard__panel dash-rise">
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
            <section className="dashboard__panel dash-rise">
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
            <section className="dashboard__panel dash-rise">
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
