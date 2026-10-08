"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import "../SalesOrders.css";
import "./OrderProfile.css";

function amount(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

export default function OrderProfileClient({ id }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const value = await apiRequest(
          `/api/sales/orders/${encodeURIComponent(id)}`,
        );

        if (active) {
          setOrder(value);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause?.message || "Unable to load this sales order.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [id, reload]);

  async function updateStatus(action) {
    if (!order) {
      return;
    }

    if (action === "cancel") {
      const confirmed = window.confirm(
        `Cancel sales order ${order.orderNumber}?`,
      );

      if (!confirmed) {
        return;
      }
    }

    setBusy(true);
    setError("");

    try {
      const updated = await apiRequest(
        `/api/sales/orders/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action }),
        },
      );

      setOrder(updated);
    } catch (cause) {
      setError(
        cause?.message ||
          `Unable to ${action} sales order.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="order-list order-detail">
      <header className="order-detail__header">
        <div className="order-detail__heading">
          <p className="order-detail__eyebrow">
            SALES / ORDERS
          </p>

          <h1>
            {order?.orderNumber || "Sales order"}
          </h1>

          <span>
            Review customer information, order items,
            pricing and approval status.
          </span>
        </div>

        <div className="order-detail__header-actions">
          <Link href="/sales/orders">
            Back to orders
          </Link>

          {order?.status === "DRAFT" && (
            <Link href={`/sales/orders/${id}/edit`}>
              Edit order
            </Link>
          )}

          {order?.status === "DRAFT" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateStatus("approve")}
            >
              {busy ? "Processing..." : "Approve"}
            </button>
          )}

          {order && order.status !== "CANCELLED" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateStatus("cancel")}
            >
              Cancel
            </button>
          )}
        </div>
      </header>

      {error && (
        <div
          className="order-detail__error"
          role="alert"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setReload((current) => current + 1)
            }
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div
          className="order-detail__state"
          role="status"
        >
          Loading sales order...
        </div>
      )}

      {!loading && !error && order && (
        <>
          <section className="order-detail__facts">
            <div>
              <span>Customer</span>

              <strong>{order.customer.name}</strong>

              <small>{order.customer.code}</small>
            </div>

            <div>
              <span>Order date</span>

              <strong>{order.orderDate}</strong>
            </div>

            <div>
              <span>Delivery date</span>

              <strong>
                {order.deliveryDate || "—"}
              </strong>
            </div>

            <div>
              <span>Status</span>

              <strong>
                <span
                  className={`order-list__status order-list__status--${String(
                    order.status || "unknown",
                  ).toLowerCase()}`}
                >
                  {order.status}
                </span>
              </strong>
            </div>
          </section>

          <section className="order-detail__section">
            <div className="order-detail__section-heading">
              <div>
                <h2>Order items</h2>

                <p>
                  {order.lines.length}{" "}
                  {order.lines.length === 1
                    ? "line item"
                    : "line items"}
                </p>
              </div>
            </div>

            <div className="order-detail__table-scroll">
              <table className="order-detail__table">
                <colgroup>
                  <col className="order-detail__col-number" />
                  <col className="order-detail__col-product" />
                  <col className="order-detail__col-reference" />
                  <col className="order-detail__col-category" />
                  <col className="order-detail__col-variant" />
                  <col className="order-detail__col-qty" />
                  <col className="order-detail__col-unit" />
                  <col className="order-detail__col-price" />
                  <col className="order-detail__col-discount" />
                  <col className="order-detail__col-tax" />
                  <col className="order-detail__col-total" />
                </colgroup>

                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product / description</th>
                    <th>SKU / reference</th>
                    <th>Category</th>
                    <th>Variant</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Unit price</th>
                    <th>Discount</th>
                    <th>Tax</th>
                    <th>Line total</th>
                  </tr>
                </thead>

                <tbody>
                  {order.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td className="order-detail__center">
                        {index + 1}
                      </td>

                      <td>
                        <div className="order-detail__product">
                          {line.isCustom && (
                            <span className="order-detail__custom">
                              CUSTOM
                            </span>
                          )}

                          <strong>
                            {line.productName}
                          </strong>

                          {line.customerReference && (
                            <small>
                              Ref: {line.customerReference}
                            </small>
                          )}

                          {line.notes && (
                            <small>
                              {line.notes}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        {line.skuReference || "—"}
                      </td>

                      <td>
                        {line.category || "—"}
                      </td>

                      <td>
                        {line.variant || "—"}
                      </td>

                      <td className="order-detail__number">
                        {line.quantity}
                      </td>

                      <td>
                        {line.unit}
                      </td>

                      <td className="order-detail__money">
                        {amount(line.unitPrice)}
                      </td>

                      <td className="order-detail__number">
                        {line.discountPercent}%
                      </td>

                      <td className="order-detail__number">
                        {line.taxPercent}%
                      </td>

                      <td className="order-detail__money order-detail__line-total">
                        {amount(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="order-detail__bottom">
            <div className="order-detail__notes">
              <div className="order-detail__section-heading">
                <div>
                  <h2>Notes / specifications</h2>
                  <p>Order-specific instructions</p>
                </div>
              </div>

              <p>
                {order.notes || "No order notes."}
              </p>
            </div>

            <div className="order-detail__totals-wrap">
              <h2>Order summary</h2>

              <dl className="order-detail__totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{amount(order.subtotal)}</dd>
                </div>

                <div>
                  <dt>Discount</dt>
                  <dd>{amount(order.discountTotal)}</dd>
                </div>

                <div>
                  <dt>Tax</dt>
                  <dd>{amount(order.taxTotal)}</dd>
                </div>

                <div className="order-detail__grand-total">
                  <dt>Order total</dt>
                  <dd>{amount(order.totalAmount)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <footer className="order-detail__audit">
            <span>
              Created{" "}
              {new Date(
                order.createdAt,
              ).toLocaleString()}
            </span>

            <span aria-hidden="true">·</span>

            <span>
              Updated{" "}
              {new Date(
                order.updatedAt,
              ).toLocaleString()}
            </span>
          </footer>
        </>
      )}
    </main>
  );
}

