"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import StockDocumentDialog from "@/components/inventory/StockDocumentDialog";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { STOCK_DOCUMENT_TYPES } from "@/server/inventory/stock-rules";

import "@/components/inventory/InventoryWorkspace.css";

const OTHER_LABELS = {
  RESERVATION: "Reservation",
  RESERVATION_RELEASE: "Reservation release",
};

export function documentTypeLabel(type) {
  return STOCK_DOCUMENT_TYPES[type]?.label ?? OTHER_LABELS[type] ?? type;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/*
 * Posted stock documents of the given types (GET /api/inventory/documents),
 * with a "new" action that posts through the shared dialog. Documents are
 * immutable once posted; each row links to its printable slip.
 */
export default function DocumentsView({ eyebrow = "Inventory", title, description, types, newLabel }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const documents = useApiData(`/api/inventory/documents${toQuery({
    documentType: type || types.join(","),
    search,
    dateFrom,
    dateTo,
    page,
    pageSize: 25,
  })}`);
  const rows = documents.data?.documents ?? [];
  const filtered = Boolean(search || type || dateFrom || dateTo);

  function reset(setter) {
    return (event) => { setter(event.target.value); setPage(1); };
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>{newLabel}</Button>
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="doc-search">Search</label>
            <input id="doc-search" type="search" value={search} placeholder="Document no. or reference" onChange={reset(setSearch)} />
          </div>
          {types.length > 1 && (
            <div className="inv-field">
              <label htmlFor="doc-type">Type</label>
              <select id="doc-type" value={type} onChange={reset(setType)}>
                <option value="">All types</option>
                {types.map((key) => <option key={key} value={key}>{documentTypeLabel(key)}</option>)}
              </select>
            </div>
          )}
          <div className="inv-field">
            <label htmlFor="doc-from">From</label>
            <input id="doc-from" type="date" value={dateFrom} onChange={reset(setDateFrom)} />
          </div>
          <div className="inv-field">
            <label htmlFor="doc-to">To</label>
            <input id="doc-to" type="date" value={dateTo} onChange={reset(setDateTo)} />
          </div>
        </div>

        {documents.error ? (
          <p className="inv-state inv-state--error" role="alert">{documents.error}</p>
        ) : documents.loading && !documents.data ? (
          <p className="inv-state" role="status">Loading documents…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{filtered ? "No documents match these filters." : "Nothing has been posted yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table" aria-busy={documents.loading}>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Reference / reason</th>
                  <th className="inv-num">Lines</th>
                  <th>Posted by</th>
                  <th>Posted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Document"><strong>{row.documentNumber}</strong></td>
                    <td data-label="Type">{documentTypeLabel(row.documentType)}</td>
                    <td data-label="Reference">
                      {row.reference || "—"}
                      {row.reason && <small>{row.reason}</small>}
                    </td>
                    <td data-label="Lines" className="inv-num">{row.lineCount}</td>
                    <td data-label="Posted by">{row.createdByName ?? "—"}</td>
                    <td data-label="Posted">{formatDateTime(row.postedAt)}</td>
                    <td data-label="Slip"><Link href={`/print/stock-documents/${row.id}`}>Print</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={documents.data?.hasMore} onChange={setPage} disabled={documents.loading} />
      </section>

      {creating && (
        <StockDocumentDialog
          open
          allowedTypes={types}
          locations={locations.data ?? []}
          onClose={() => setCreating(false)}
          onPosted={() => documents.reload()}
        />
      )}
    </main>
  );
}
