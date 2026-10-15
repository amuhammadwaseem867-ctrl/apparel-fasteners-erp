"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import InspectionDialog, { INSPECTION_TYPE_LABELS } from "@/components/quality/InspectionDialog";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export function InspectionStatusBadge({ status }) {
  const tone = status === "APPROVED" ? "good" : status === "CANCELLED" ? "danger" : "warning";
  return <span className={`inv-badge inv-badge--${tone}`}>{status === "OPEN" ? "Awaiting approval" : status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

/*
 * Inspections from GET /api/quality/inspections. The quality pages are this
 * list with a fixed type, or only inspections with rework/rejections.
 */
export default function QualityInspectionList({ type = "", failedOnly = false, title, description, emptyText, openForOrderId = "" }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(Boolean(openForOrderId));
  const inspections = useApiData(`/api/quality/inspections${toQuery({
    inspectionType: type, status, search, failedOnly: failedOnly ? "true" : "", page, pageSize: 25,
  })}`);
  const rows = inspections.data?.inspections ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Quality</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>Record inspection</Button>
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="qi-search">Search</label>
            <input id="qi-search" type="search" placeholder="Inspection number, SKU or item" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="inv-field">
            <label htmlFor="qi-status">Status</label>
            <select id="qi-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="OPEN">Awaiting approval</option>
              <option value="APPROVED">Approved</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {inspections.error ? (
          <p className="inv-state inv-state--error" role="alert">{inspections.error}</p>
        ) : !inspections.data ? (
          <p className="inv-state" role="status">Loading inspections…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status ? "No inspections match these filters." : emptyText}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Inspection</th>{!type && <th>Type</th>}<th>Item</th><th>Source</th>
                  <th className="inv-num">Inspected</th><th className="inv-num">Passed</th><th className="inv-num">Rework</th><th className="inv-num">Rejected</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Inspection"><Link href={`/quality/inspections/${row.id}`}><strong>{row.inspectionNumber}</strong></Link><small>{new Date(row.createdAt).toLocaleDateString("en-GB")}</small></td>
                    {!type && <td data-label="Type">{INSPECTION_TYPE_LABELS[row.inspectionType]}</td>}
                    <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                    <td data-label="Source">{row.orderNumber ? <Link href={`/production/orders/${row.productionOrderId}`}>{row.orderNumber}</Link> : row.locationLabel}<small>{row.stageLabel ?? ""}</small></td>
                    <td data-label="Inspected" className="inv-num">{row.inspectedQuantity} {row.unit}</td>
                    <td data-label="Passed" className="inv-num">{row.passedQuantity}</td>
                    <td data-label="Rework" className="inv-num">{row.reworkQuantity}</td>
                    <td data-label="Rejected" className={`inv-num ${Number(row.rejectedQuantity) > 0 ? "inv-neg" : ""}`}>{row.rejectedQuantity}</td>
                    <td data-label="Status"><InspectionStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={inspections.data?.hasMore} onChange={setPage} disabled={inspections.loading} />
      </section>

      {creating && (
        <InspectionDialog
          fixedType={type || undefined}
          initialOrderId={openForOrderId}
          onClose={() => setCreating(false)}
          onCreated={(created) => router.push(`/quality/inspections/${created.id}`)}
        />
      )}
    </main>
  );
}
