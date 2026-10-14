"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import InventoryPager from "@/components/inventory/InventoryPager";
import { documentTypeLabel } from "@/components/inventory/DocumentsView";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { apiRequest } from "@/lib/api/client";
import { formatUnitPrice } from "@/lib/formatters/formatters";

import "@/components/inventory/InventoryWorkspace.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET_LABELS = { ON_HAND: "On hand", RESERVED: "Reserved", QUALITY_HOLD: "QC hold" };

function useItem(itemRef) {
  const [state, setState] = useState({ item: null, error: "", loading: true });

  useEffect(() => {
    let active = true;
    const load = UUID.test(itemRef)
      ? apiRequest(`/api/products/${itemRef}`)
      : apiRequest(`/api/products${toQuery({ search: itemRef, pageSize: 100 })}`).then((result) => {
        const match = result.products.find((product) => product.sku === itemRef);
        if (!match) throw new Error(`No item with SKU ${itemRef}.`);
        return match;
      });

    load
      .then((item) => { if (active) setState({ item, error: "", loading: false }); })
      .catch((cause) => { if (active) setState({ item: null, error: cause.message, loading: false }); });

    return () => { active = false; };
  }, [itemRef]);

  return state;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function ItemProfileClient({ itemRef }) {
  const { item, error, loading } = useItem(itemRef);
  const [page, setPage] = useState(1);
  const id = item?.id;
  const balances = useApiData(id ? `/api/inventory/balances${toQuery({ productId: id, pageSize: 100 })}` : null);
  const reservations = useApiData(id ? `/api/inventory/reservations${toQuery({ productId: id, status: "ACTIVE", pageSize: 50 })}` : null);
  const movements = useApiData(id ? `/api/inventory/movements${toQuery({ productId: id, page, pageSize: 25 })}` : null);

  if (loading) return <main className="inv-page"><p className="inv-state" role="status">Loading item…</p></main>;
  if (error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{error}</p><Link href="/inventory/item-master">Back to item master</Link></main>;

  const spec = [
    ["Category", item.category], ["Type", item.productType], ["Size", item.size], ["Material", item.material],
    ["Item type", item.itemType], ["Finish", item.finish], ["Colour", item.color], ["Variant", item.variant],
    ["Logo / plain", item.logoType], ["Unit", item.unit], ["Unit price", formatUnitPrice(item.unitPrice)],
    ["Minimum stock", item.minimumStock], ["Barcode", item.barcode], ["Status", item.status],
  ];
  const stockRows = balances.data?.balances ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Item master</p>
          <h1>{item.sku}</h1>
          <p>{item.name}</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/inventory/item-master">Back</Link>
          {item.status !== "ARCHIVED" && <Link className="inv-link-button" href={`/products/${item.id}/edit`}>Edit item</Link>}
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Specification</h2></div>
        <div className="inv-kpis" style={{ padding: 16 }}>
          {spec.map(([label, value]) => (
            <div className="inv-kpi" key={label}>
              <span>{label}</span>
              <small style={{ fontSize: 14, color: "inherit", fontWeight: 700 }}>{value === null || value === undefined || value === "" ? "—" : String(value)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Stock by location</h2></div>
        {balances.error ? <p className="inv-state inv-state--error" role="alert">{balances.error}</p>
          : !balances.data ? <p className="inv-state" role="status">Loading…</p>
            : stockRows.length === 0 ? <p className="inv-state">No stock has been posted for this item.</p> : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead><tr><th>Location</th><th className="inv-num">On hand</th><th className="inv-num">Reserved</th><th className="inv-num">QC hold</th><th className="inv-num">Available</th></tr></thead>
                  <tbody>
                    {stockRows.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Location">{row.warehouseCode}/{row.locationCode}<small>{row.warehouseName}</small></td>
                        <td data-label="On hand" className="inv-num">{row.onHand}</td>
                        <td data-label="Reserved" className="inv-num">{row.reserved}</td>
                        <td data-label="QC hold" className="inv-num">{row.qualityHold}</td>
                        <td data-label="Available" className="inv-num"><strong>{row.available}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Active reservations</h2></div>
        {reservations.error ? <p className="inv-state inv-state--error" role="alert">{reservations.error}</p>
          : (reservations.data?.reservations ?? []).length === 0 ? <p className="inv-state">No active reservations.</p> : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Location</th><th>Order</th><th className="inv-num">Open</th></tr></thead>
                <tbody>
                  {reservations.data.reservations.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Location">{row.warehouseCode}/{row.locationCode}</td>
                      <td data-label="Order">{row.salesOrderId ? <Link href={`/sales/orders/${row.salesOrderId}`}>View order</Link> : "—"}</td>
                      <td data-label="Open" className="inv-num">{row.openQuantity} {row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Movement history</h2></div>
        {movements.error ? <p className="inv-state inv-state--error" role="alert">{movements.error}</p>
          : (movements.data?.movements ?? []).length === 0 ? <p className="inv-state">No movements yet.</p> : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Date</th><th>Document</th><th>Type</th><th>Location</th><th>Bucket</th><th className="inv-num">Change</th><th className="inv-num">Balance after</th></tr></thead>
                <tbody>
                  {movements.data.movements.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Date">{formatDateTime(row.createdAt)}</td>
                      <td data-label="Document"><Link href={`/print/stock-documents/${row.documentId}`}>{row.documentNumber}</Link></td>
                      <td data-label="Type">{documentTypeLabel(row.movementType)}</td>
                      <td data-label="Location">{row.warehouseCode}/{row.locationCode}</td>
                      <td data-label="Bucket">{BUCKET_LABELS[row.bucket]}</td>
                      <td data-label="Change" className={`inv-num ${row.quantityDelta.startsWith("-") ? "inv-neg" : "inv-pos"}`}>{row.quantityDelta.startsWith("-") ? row.quantityDelta : `+${row.quantityDelta}`}</td>
                      <td data-label="Balance after" className="inv-num">{row.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <InventoryPager page={page} hasMore={movements.data?.hasMore} onChange={setPage} disabled={movements.loading} />
      </section>
    </main>
  );
}
