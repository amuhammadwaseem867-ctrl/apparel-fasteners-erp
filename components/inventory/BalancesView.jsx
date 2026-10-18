"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import StockDocumentDialog from "@/components/inventory/StockDocumentDialog";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/*
 * Stock positions per item and storage location from
 * GET /api/inventory/balances. Used by Stock, Finished Goods and WIP pages
 * (the latter two fix `warehouseType`). Transaction buttons open the
 * shared posting dialog; the table reloads after the server confirms.
 */

const ACTIONS = [
  { label: "Receive", types: ["GOODS_RECEIPT", "STOCK_IN", "FG_RECEIPT", "MATERIAL_RETURN"], primary: true },
  { label: "Issue / Out", types: ["MATERIAL_ISSUE", "FG_DISPATCH", "STOCK_OUT"] },
  { label: "Adjust / Count", types: ["ADJUSTMENT", "COUNT"] },
  { label: "Quality hold", types: ["QC_HOLD", "QC_RELEASE"] },
];

export default function BalancesView({
  eyebrow = "Inventory",
  title,
  description,
  warehouseType = "",
  actions = ACTIONS,
  emptyText = "No stock has been posted yet. Use Receive to record the first goods receipt.",
}) {
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);

  const warehouses = useApiData("/api/inventory/warehouses?status=ACTIVE");
  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const balances = useApiData(`/api/inventory/balances${toQuery({ search, warehouseId, warehouseType, page, pageSize: 25 })}`);

  const visibleWarehouses = (warehouses.data ?? []).filter(
    (warehouse) => !warehouseType || warehouse.warehouseType === warehouseType,
  );
  const rows = balances.data?.balances ?? [];
  // Reserved quantities are not part of the simple process; the column shows only when something is reserved.
  const showReserved = rows.some((row) => Number(row.reserved) !== 0);

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="inv-header__actions">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.primary ? "primary" : "secondary"}
              onClick={() => setDialog(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="bal-search">Search item</label>
            <input
              id="bal-search"
              type="search"
              value={search}
              placeholder="SKU or item name"
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </div>
          <div className="inv-field">
            <label htmlFor="bal-wh">Warehouse</label>
            <select id="bal-wh" value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setPage(1); }}>
              <option value="">All warehouses</option>
              {visibleWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.code} — {warehouse.name}</option>
              ))}
            </select>
          </div>
          <Button variant="secondary" onClick={balances.reload} disabled={balances.loading}>
            Refresh
          </Button>
        </div>

        {balances.error ? (
          <p className="inv-state inv-state--error" role="alert">{balances.error}</p>
        ) : balances.loading && !balances.data ? (
          <p className="inv-state" role="status">Loading stock…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || warehouseId ? "No stock matches these filters." : emptyText}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table" aria-busy={balances.loading}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Location</th>
                  <th className="inv-num">On hand</th>
                  {showReserved && <th className="inv-num">Reserved</th>}
                  <th className="inv-num">QC hold</th>
                  <th className="inv-num">Available</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Item">
                      <Link href={`/inventory/item-master/${encodeURIComponent(row.productId)}`}>{row.sku}</Link>
                      <small>{row.productName}</small>
                    </td>
                    <td data-label="Location">
                      {row.warehouseCode}/{row.locationCode}
                      <small>{row.warehouseName}</small>
                    </td>
                    <td data-label="On hand" className="inv-num">{row.onHand}</td>
                    {showReserved && <td data-label="Reserved" className="inv-num">{row.reserved}</td>}
                    <td data-label="QC hold" className="inv-num">{row.qualityHold}</td>
                    <td data-label="Available" className="inv-num"><strong>{row.available}</strong></td>
                    <td data-label="Unit">{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={balances.data?.hasMore} onChange={setPage} disabled={balances.loading} />
      </section>

      {dialog && (
        <StockDocumentDialog
          key={dialog.label}
          open
          allowedTypes={dialog.types}
          locations={locations.data ?? []}
          onClose={() => setDialog(null)}
          onPosted={() => balances.reload()}
        />
      )}
    </main>
  );
}
