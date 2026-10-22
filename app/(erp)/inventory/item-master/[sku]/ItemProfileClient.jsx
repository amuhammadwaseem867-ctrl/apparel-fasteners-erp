"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import Button from "@/components/ui/Button";
import StockDocumentDialog from "@/components/inventory/StockDocumentDialog";
import { documentTypeLabel } from "@/components/inventory/DocumentsView";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { apiRequest } from "@/lib/api/client";
import { formatUnitPrice } from "@/lib/formatters/formatters";

import "@/components/inventory/InventoryWorkspace.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const qty = (value) => (value === null || value === undefined ? "â€”" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }));
const ACTIONS = { GOODS_RECEIPT: "Receive", MATERIAL_ISSUE: "Issue to production", MATERIAL_RETURN: "Return from production" };

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
  const [range, setRange] = useState({ dateFrom: "", dateTo: "" });
  const [dialog, setDialog] = useState("");
  const id = item?.id;
  const balances = useApiData(id ? `/api/inventory/balances${toQuery({ productId: id, pageSize: 100 })}` : null);
  const reservations = useApiData(id ? `/api/inventory/reservations${toQuery({ productId: id, status: "ACTIVE", pageSize: 50 })}` : null);
  const card = useApiData(id ? `/api/inventory/raw-material/${id}${toQuery(range)}` : null);
  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const all = useApiData(id ? `/api/inventory/raw-material/${id}` : null);

  if (loading) return <main className="inv-page"><p className="inv-state" role="status">Loading itemâ€¦</p></main>;
  if (error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{error}</p><Link href="/inventory/item-master">Back to item master</Link></main>;

  const spec = [
    ["Category", item.category], ["Type", item.productType], ["Size", item.size], ["Material", item.material],
    ["Item type", item.itemType], ["Finish", item.finish], ["Colour", item.color], ["Variant", item.variant],
    ["Logo / plain", item.logoType], ["Unit", item.unit], ["Unit price", formatUnitPrice(item.unitPrice)],
    ["Minimum stock", item.minimumStock], ["Unit weight", item.unitWeightGrams ? `${item.unitWeightGrams} g per piece` : "Not set"],
    ["Barcode", item.barcode], ["Status", item.status],
  ];
  const stockRows = balances.data?.balances ?? [];
  const showReserved = stockRows.some((row) => Number(row.reserved) !== 0);
  const totals = all.data;
  const locationList = locations.data ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Item master</p>
          <h1>{item.sku}</h1>
          <p>{item.name}</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/inventory/raw-material">Back</Link>
          {item.status !== "ARCHIVED" && <Link className="inv-link-button" href={`/products/${item.id}/edit`}>Edit item</Link>}
          {item.status === "ACTIVE" && Object.entries(ACTIONS).map(([type, label]) => (
            <Button key={type} variant={type === "GOODS_RECEIPT" ? "primary" : "secondary"} onClick={() => setDialog(type)}>{label}</Button>
          ))}
        </div>
      </header>

      {totals && (
        <section className="inv-kpis" aria-label="Stock summary">
          <div className="inv-kpi"><span>Received</span><strong>{qty(totals.received)}</strong><small>{item.unit}, all time</small></div>
          <div className="inv-kpi"><span>Issued to production</span><strong>{qty(totals.issued)}</strong><small>{item.unit}, all time{Number(totals.returned) > 0 ? ` · ${qty(totals.returned)} returned` : ""}</small></div>
          <div className="inv-kpi"><span>Current stock</span><strong>{qty(totals.closingBalance)}</strong><small>{item.unit}{totals.closing.pieces && item.unit !== "Pcs" ? ` · ${qty(totals.closing.pieces)} pcs` : ""}{totals.closing.kg && !/^kgs?$/i.test(item.unit) ? ` · ${qty(totals.closing.kg)} kg` : ""}</small></div>
        </section>
      )}

      <section className="inv-card">
        <div className="inv-card__header"><h2>Specification</h2></div>
        <div className="inv-kpis" style={{ padding: 16 }}>
          {spec.map(([label, value]) => (
            <div className="inv-kpi" key={label}>
              <span>{label}</span>
              <small style={{ fontSize: 14, color: "inherit", fontWeight: 700 }}>{value === null || value === undefined || value === "" ? "â€”" : String(value)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Stock by location</h2></div>
        {balances.error ? <p className="inv-state inv-state--error" role="alert">{balances.error}</p>
          : !balances.data ? <p className="inv-state" role="status">Loadingâ€¦</p>
            : stockRows.length === 0 ? <p className="inv-state">No stock has been posted for this item.</p> : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead><tr><th>Location</th><th className="inv-num">On hand</th>{showReserved && <th className="inv-num">Reserved</th>}<th className="inv-num">QC hold</th><th className="inv-num">Available</th></tr></thead>
                  <tbody>
                    {stockRows.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Location">{row.warehouseCode}/{row.locationCode}<small>{row.warehouseName}</small></td>
                        <td data-label="On hand" className="inv-num">{row.onHand}</td>
                        {showReserved && <td data-label="Reserved" className="inv-num">{row.reserved}</td>}
                        <td data-label="QC hold" className="inv-num">{row.qualityHold}</td>
                        <td data-label="Available" className="inv-num"><strong>{row.available}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </section>

      {/* Reservations are not part of the simple process; shown only when an item has some. */}
      {(reservations.error || (reservations.data?.reservations ?? []).length > 0) && (
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
                      <td data-label="Order">{row.salesOrderId ? <Link href={`/sales/orders/${row.salesOrderId}`}>View order</Link> : "â€”"}</td>
                      <td data-label="Open" className="inv-num">{row.openQuantity} {row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
      )}

      <section className="inv-card">
        <div className="inv-card__header">
          <div><h2>Stock card</h2><small>Every receipt, issue, return and adjustment, oldest first, with the running balance.</small></div>
          <Link className="inv-link-button" href={`/print/inventory/items/${item.id}${toQuery(range)}`}><Printer size={16} /> Print stock card</Link>
        </div>
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="sc-from">From</label><input id="sc-from" type="date" value={range.dateFrom} onChange={(event) => setRange((current) => ({ ...current, dateFrom: event.target.value }))} /></div>
          <div className="inv-field"><label htmlFor="sc-to">To</label><input id="sc-to" type="date" value={range.dateTo} onChange={(event) => setRange((current) => ({ ...current, dateTo: event.target.value }))} /></div>
        </div>
        {card.error ? <p className="inv-state inv-state--error" role="alert">{card.error}</p>
          : !card.data ? <p className="inv-state" role="status">Loadingâ€¦</p> : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Date</th><th>Document</th><th>Transaction</th><th>Reference</th><th>Location</th><th className="inv-num">In</th><th className="inv-num">Out</th><th className="inv-num">Balance</th><th>By</th></tr></thead>
                <tbody>
                  <tr><td colSpan={7}><strong>Opening balance</strong></td><td className="inv-num"><strong>{qty(card.data.openingBalance)}</strong></td><td /></tr>
                  {card.data.lines.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Date">{formatDateTime(row.createdAt)}</td>
                      <td data-label="Document"><Link href={`/print/stock-documents/${row.documentId}`}>{row.documentNumber}</Link></td>
                      <td data-label="Transaction">{documentTypeLabel(row.movementType)}</td>
                      <td data-label="Reference">{row.reference || row.reason || "â€”"}</td>
                      <td data-label="Location">{row.location}</td>
                      <td data-label="In" className="inv-num inv-pos">{row.quantityIn ? qty(row.quantityIn) : ""}</td>
                      <td data-label="Out" className="inv-num inv-neg">{row.quantityOut ? qty(row.quantityOut) : ""}</td>
                      <td data-label="Balance" className="inv-num"><strong>{qty(row.balance)}</strong></td>
                      <td data-label="By">{row.userName ?? "â€”"}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={5}><strong>Closing balance</strong></td><td className="inv-num"><strong>{qty(card.data.totalIn)}</strong></td><td className="inv-num"><strong>{qty(card.data.totalOut)}</strong></td><td className="inv-num"><strong>{qty(card.data.closingBalance)}</strong></td><td /></tr>
                </tbody>
              </table>
              {card.data.truncated && <p className="inv-state">Showing the first 2000 movements; narrow the dates to see the rest.</p>}
            </div>
          )}
      </section>

      {dialog && (
        <StockDocumentDialog
          key={dialog}
          open
          documentType={dialog}
          locations={locationList}
          initialLine={{ item, locationId: locationList.length === 1 ? locationList[0].id : "" }}
          onClose={() => setDialog("")}
          onPosted={() => { card.reload(); all.reload(); balances.reload(); }}
        />
      )}
    </main>
  );
}

