"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import { documentTypeLabel } from "@/components/inventory/DocumentsView";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { STOCK_DOCUMENT_TYPE_KEYS } from "@/server/inventory/stock-rules";

import "@/components/inventory/InventoryWorkspace.css";

const BUCKET_LABELS = { ON_HAND: "On hand", RESERVED: "Reserved", QUALITY_HOLD: "QC hold" };
const TYPES = [...STOCK_DOCUMENT_TYPE_KEYS, "RESERVATION", "RESERVATION_RELEASE"];

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/*
 * The stock ledger (GET /api/inventory/movements): every change to every
 * balance bucket, newest first, with the signed quantity and the balance
 * it left. Rows are append-only and never edited.
 */
export default function MovementsPage() {
  const [documentType, setDocumentType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const movements = useApiData(`/api/inventory/movements${toQuery({ documentType, dateFrom, dateTo, page, pageSize: 50 })}`);
  const rows = movements.data?.movements ?? [];
  const filtered = Boolean(documentType || dateFrom || dateTo);

  function change(setter) {
    return (event) => { setter(event.target.value); setPage(1); };
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Inventory</p>
          <h1>Stock Movements</h1>
          <p>The permanent stock ledger. Every posted document writes one row per balance it changes, with the resulting balance.</p>
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="mv-type">Transaction type</label>
            <select id="mv-type" value={documentType} onChange={change(setDocumentType)}>
              <option value="">All types</option>
              {TYPES.map((type) => <option key={type} value={type}>{documentTypeLabel(type)}</option>)}
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="mv-from">From</label>
            <input id="mv-from" type="date" value={dateFrom} onChange={change(setDateFrom)} />
          </div>
          <div className="inv-field">
            <label htmlFor="mv-to">To</label>
            <input id="mv-to" type="date" value={dateTo} onChange={change(setDateTo)} />
          </div>
          <Button variant="secondary" onClick={movements.reload} disabled={movements.loading}>Refresh</Button>
        </div>

        {movements.error ? (
          <p className="inv-state inv-state--error" role="alert">{movements.error}</p>
        ) : movements.loading && !movements.data ? (
          <p className="inv-state" role="status">Loading movements…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{filtered ? "No movements match these filters." : "No stock movements have been posted yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table" aria-busy={movements.loading}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Location</th>
                  <th>Bucket</th>
                  <th className="inv-num">Change</th>
                  <th className="inv-num">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Date">{formatDateTime(row.createdAt)}</td>
                    <td data-label="Document">
                      <Link href={`/print/stock-documents/${row.documentId}`}>{row.documentNumber}</Link>
                      {row.reference && <small>{row.reference}</small>}
                    </td>
                    <td data-label="Type">{documentTypeLabel(row.movementType)}</td>
                    <td data-label="Item">
                      <Link href={`/inventory/item-master/${row.productId}`}>{row.sku}</Link>
                      <small>{row.productName}</small>
                    </td>
                    <td data-label="Location">{row.warehouseCode}/{row.locationCode}</td>
                    <td data-label="Bucket">{BUCKET_LABELS[row.bucket] ?? row.bucket}</td>
                    <td data-label="Change" className={`inv-num ${row.quantityDelta.startsWith("-") ? "inv-neg" : "inv-pos"}`}>
                      {row.quantityDelta.startsWith("-") ? row.quantityDelta : `+${row.quantityDelta}`} {row.unit}
                    </td>
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
