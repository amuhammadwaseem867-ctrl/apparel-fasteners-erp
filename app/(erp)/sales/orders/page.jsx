"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import "./SalesOrders.css";

const PAGE_SIZE = 25;

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toFixed(2);
}

export default function OrdersPage() {
  const [filters, setFilters] = useState({
    search: "",
    customerId: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const [customers, setCustomers] = useState([]);
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      try {
        const data = await apiRequest(
          `/api/sales/orders?${params.toString()}`,
        );

        if (active) {
          setResult(data);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause?.message || "Unable to load sales orders.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters, page, refresh]);

  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      try {
        const value = await apiRequest(
          "/api/customers?page=1&pageSize=100",
        );

        if (active) {
          setCustomers(value.customers ?? []);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause?.message || "Unable to load customers.",
          );
        }
      }
    }

    loadCustomers();

    return () => {
      active = false;
    };
  }, []);

  function setFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
  }

  async function changeStatus(order, action) {
    if (action === "cancel") {
      const confirmed = window.confirm(
        `Cancel sales order ${order.orderNumber}?`,
      );

      if (!confirmed) {
        return;
      }
    }

    setActionBusy(`${order.id}:${action}`);
    setError("");

    try {
      await apiRequest(
        `/api/sales/orders/${encodeURIComponent(order.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action }),
        },
      );

      setRefresh((current) => current + 1);
    } catch (cause) {
      setError(
        cause?.message ||
          `Unable to ${action} sales order.`,
      );
    } finally {
      setActionBusy("");
    }
  }

  const orders = result?.orders ?? [];

  return (
    <main className="order-list">
      <header className="order-list__header">
        <div className="order-list__heading">
          <p className="order-list__eyebrow">
            SALES / CRM
          </p>

          <h1>Sales orders</h1>

          <span>
            Manage customer orders, line items and approval
            status.
          </span>
        </div>

        <Link
          className="order-list__primary"
          href="/sales/orders/new"
        >
          + New sales order
        </Link>
      </header>

      <section
        className="order-list__filters"
        aria-label="Sales order filters"
      >
        <label>
          <span>Search</span>

          <input
            type="search"
            placeholder="Order number or customer"
            value={filters.search}
            onChange={(event) =>
              setFilter("search", event.target.value)
            }
          />
        </label>

        <label>
          <span>Customer</span>

          <select
            value={filters.customerId}
            onChange={(event) =>
              setFilter(
                "customerId",
                event.target.value,
              )
            }
          >
            <option value="">All customers</option>

            {customers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.code} — {customer.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Status</span>

          <select
            value={filters.status}
            onChange={(event) =>
              setFilter("status", event.target.value)
            }
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>

        <label>
          <span>Order date from</span>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilter("dateFrom", event.target.value)
            }
          />
        </label>

        <label>
          <span>Order date to</span>

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilter("dateTo", event.target.value)
            }
          />
        </label>
      </section>

      {error && (
        <div className="order-list__top-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setRefresh((current) => current + 1)
            }
          >
            Retry
          </button>
        </div>
      )}

      <section className="order-list__panel">
        <div className="order-list__scroll">
          <table className="order-list__table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Date</th>
                <th className="order-list__numeric">
                  Items
                </th>
                <th className="order-list__numeric">
                  Total
                </th>
                <th>Status</th>
                <th className="order-list__actions-head">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan="7"
                    className="order-list__message"
                  >
                    Loading sales orders...
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                orders.length === 0 && (
                  <tr>
                    <td
                      colSpan="7"
                      className="order-list__message"
                    >
                      No sales orders found.
                    </td>
                  </tr>
                )}

              {!loading &&
                !error &&
                orders.map((order) => {
                  const busy =
                    actionBusy.startsWith(`${order.id}:`);

                  return (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/sales/orders/${order.id}`}
                        >
                          {order.orderNumber}
                        </Link>
                      </td>

                      <td>
                        <strong>
                          {order.customerName}
                        </strong>
                      </td>

                      <td>{order.orderDate}</td>

                      <td className="order-list__numeric">
                        {order.items}
                      </td>

                      <td className="order-list__numeric">
                        {money(order.totalAmount)}
                      </td>

                      <td>
                        <span
                          className={`order-list__status order-list__status--${String(
                            order.status || "UNKNOWN",
                          ).toLowerCase()}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td className="order-list__actions">
                        <Link
                          href={`/sales/orders/${order.id}`}
                        >
                          View
                        </Link>

                        {order.status === "DRAFT" && (
                          <>
                            <Link
                              href={`/sales/orders/${order.id}/edit`}
                            >
                              Edit
                            </Link>

                            <button
                              type="button"
                              disabled={Boolean(actionBusy)}
                              onClick={() =>
                                changeStatus(
                                  order,
                                  "approve",
                                )
                              }
                            >
                              {busy &&
                              actionBusy.endsWith(
                                ":approve",
                              )
                                ? "Approving..."
                                : "Approve"}
                            </button>
                          </>
                        )}

                        {order.status !== "CANCELLED" && (
                          <button
                            type="button"
                            disabled={Boolean(actionBusy)}
                            onClick={() =>
                              changeStatus(
                                order,
                                "cancel",
                              )
                            }
                          >
                            {busy &&
                            actionBusy.endsWith(
                              ":cancel",
                            )
                              ? "Cancelling..."
                              : "Cancel"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <footer className="order-list__pagination">
          <span>
            Page {page}
            {result?.hasMore ? "+" : ""}
          </span>

          <div>
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() =>
                setPage((value) => value - 1)
              }
            >
              Previous
            </button>

            <button
              type="button"
              disabled={loading || !result?.hasMore}
              onClick={() =>
                setPage((value) => value + 1)
              }
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
