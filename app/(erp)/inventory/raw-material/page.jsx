"use client";

/*
 * Raw Material Stock (D-044): the live count of every raw material, from
 * GET /api/inventory/raw-material. Received less issued to production
 * (plus returns) is what is in stock now; it is shown in the item's own
 * unit and, when the unit weight is set, in pieces and kg. Finished
 * products are left out unless "Show finished products" is ticked.
 * Receive, issue and return post real stock documents.
 */

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Printer, RotateCcw } from "lucide-react";

import Button from "@/components/ui/Button";
import StockDocumentDialog from "@/components/inventory/StockDocumentDialog";
import { apiRequest } from "@/lib/api/client";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "./RawMaterial.css";

const ACTIONS = {
  receive: { type: "GOODS_RECEIPT", label: "Receive material", icon: ArrowDownToLine },
  issue: { type: "MATERIAL_ISSUE", label: "Issue to production", icon: ArrowUpFromLine },
  return: { type: "MATERIAL_RETURN", label: "Return from production", icon: RotateCcw },
};

const STATUS = {
  OK: <span className="inv-badge inv-badge--good">In stock</span>,
  LOW: <span className="inv-badge inv-badge--warning">Low</span>,
  OUT: <span className="inv-badge inv-badge--danger">Out of stock</span>,
};

const dash = (value) => (value === null || value === undefined || value === "" ? "â€”" : value);
const qty = (value) => (value === null || value === undefined ? "â€”" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }));

function SetupBanner({ list, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function add() {
    setBusy(true);
    setError("");
    try {
      const done = await apiRequest("/api/inventory/raw-material/setup", { method: "POST" });
      setResult(done);
      onDone();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <p className="rm-banner rm-banner--done" role="status">
        Added {result.created.length} items{result.activated.length ? `, made ${result.activated.length} active` : ""}
        {result.corrected.length ? `, set ${result.corrected.length} #4.5 teeth to Y-Cut` : ""}
        {result.warehouse.created ? `, created warehouse ${result.warehouse.code}` : ""}. Stock starts at zero: receive material to add it.
      </p>
    );
  }
  if (!list || list.missing === 0) return null;
  return (
    <div className="rm-banner">
      <div>
        <strong>{list.missing} of {list.size} AF7 raw materials are not in the list yet.</strong>
        <span>Teeth, top stops, bottoms, pin boxes, two pins and sliders. They are added as active items with zero stock; nothing is duplicated.</span>
      </div>
      <Button variant="primary" loading={busy} onClick={add}>Add AF7 raw materials</Button>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
    </div>
  );
}

export default function RawMaterialPage() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState("");
  const [includeProducts, setIncludeProducts] = useState(false);
  const [dialog, setDialog] = useState(null);
  const query = toQuery({ category, search, stock, includeProducts: includeProducts ? "true" : "" });
  const data = useApiData(`/api/inventory/raw-material${query}`);
  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const rows = data.data?.items ?? [];
  const locationList = locations.data ?? [];
  const onlyLocation = locationList.length === 1 ? locationList[0].id : "";

  function open(action, item) {
    setDialog({ action, initialLine: { item: item ? { ...item, id: item.id } : null, locationId: onlyLocation } });
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Inventory</p>
          <h1>Raw Material Stock</h1>
          <p>Live count of every raw material: what came in, what was issued to production and what is left now.</p>
        </div>
        <div className="inv-header__actions">
          {Object.entries(ACTIONS).map(([key, { label, icon }]) => (
            <Button key={key} variant={key === "receive" ? "primary" : "secondary"} icon={icon} onClick={() => open(key)}>
              {label}
            </Button>
          ))}
          <Link className="inv-link-button rm-print" href={`/print/inventory/raw-material${query}`}><Printer size={16} /> Print list</Link>
        </div>
      </header>

      <SetupBanner list={data.data?.standardList} onDone={() => data.reload()} />

      {data.data && (
        <section className="inv-kpis" aria-label="Stock alerts">
          <button type="button" className={`inv-kpi rm-kpi${stock === "" ? " is-active" : ""}`} onClick={() => setStock("")}><span>Items</span><strong>{data.data.counts.items}</strong><small>in this list</small></button>
          <button type="button" className={`inv-kpi inv-kpi--warning rm-kpi${stock === "LOW" ? " is-active" : ""}`} onClick={() => setStock(stock === "LOW" ? "" : "LOW")}><span>Low stock</span><strong>{data.data.counts.low}</strong><small>below minimum level</small></button>
          <button type="button" className={`inv-kpi inv-kpi--danger rm-kpi${stock === "OUT" ? " is-active" : ""}`} onClick={() => setStock(stock === "OUT" ? "" : "OUT")}><span>Out of stock</span><strong>{data.data.counts.out}</strong><small>nothing available</small></button>
        </section>
      )}

      <section className="inv-card">
        <div className="inv-chips" role="tablist" aria-label="Category">
          {["", ...(data.data?.categories ?? [])].map((value) => (
            <button key={value || "all"} type="button" role="tab" aria-selected={category === value} className={`inv-chip${category === value ? " is-active" : ""}`} onClick={() => setCategory(value)}>
              {value || "All"}
            </button>
          ))}
        </div>
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="rm-search">Search</label>
            <input id="rm-search" type="search" value={search} placeholder="Item no, size, type or finish" onChange={(event) => setSearch(event.target.value)} />
          </div>
          <label className="rm-toggle">
            <input type="checkbox" checked={includeProducts} onChange={(event) => setIncludeProducts(event.target.checked)} />
            Show finished products
          </label>
        </div>

        {data.error ? (
          <p className="inv-state inv-state--error" role="alert">{data.error}</p>
        ) : !data.data ? (
          <p className="inv-state" role="status">Loading stockâ€¦</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || category || stock ? "No items match these filters." : "No raw materials yet. Add the AF7 list above, or create an item."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table rm-table">
              <thead>
                <tr>
                  <th>Item no</th><th>Size</th><th>Type</th><th>Finish</th><th>Variant</th><th>Unit</th>
                  <th className="inv-num">Unit wt (g)</th><th className="inv-num">Received</th><th className="inv-num">Issued</th>
                  <th className="inv-num">Current stock</th><th className="inv-num">Pieces</th><th className="inv-num">Kg</th>
                  <th>Location</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Item no"><Link href={`/inventory/item-master/${item.id}`}><strong>{item.sku}</strong></Link><small>{item.category}</small></td>
                    <td data-label="Size">{dash(item.size)}</td>
                    <td data-label="Type">{dash([item.itemType, item.material].filter(Boolean).join(" · "))}</td>
                    <td data-label="Finish">{dash(item.finish || item.color)}</td>
                    <td data-label="Variant">{dash([item.variant, item.logoType].filter(Boolean).join(" · "))}</td>
                    <td data-label="Unit">{item.unit}</td>
                    <td data-label="Unit wt (g)" className="inv-num">{dash(item.unitWeightGrams)}</td>
                    <td data-label="Received" className="inv-num">{qty(item.received)}</td>
                    <td data-label="Issued" className="inv-num">{qty(item.issued)}{Number(item.returned) > 0 && <small>{qty(item.returned)} returned</small>}</td>
                    <td data-label="Current stock" className="inv-num"><strong>{qty(item.onHand)}</strong>{Number(item.reserved) > 0 && <small>{qty(item.available)} available</small>}</td>
                    <td data-label="Pieces" className="inv-num">{qty(item.pieces)}</td>
                    <td data-label="Kg" className="inv-num">{qty(item.kg)}</td>
                    <td data-label="Location">{dash(item.locations)}</td>
                    <td data-label="Status">{STATUS[item.stockStatus]}</td>
                    <td data-label="" className="rm-row-actions">
                      <button type="button" className="inv-text-button" onClick={() => open("receive", item)}>Receive</button>
                      <button type="button" className="inv-text-button" disabled={Number(item.available) <= 0} onClick={() => open("issue", item)}>Issue</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="rm-footnote">Pieces and kg are worked out from the unit weight; set it on the item (Edit item) to see both. Received counts goods receipts and stock in; issued is material issued to production.</p>
      </section>

      {dialog && (
        <StockDocumentDialog
          key={dialog.action}
          open
          documentType={ACTIONS[dialog.action].type}
          locations={locationList}
          initialLine={dialog.initialLine}
          onClose={() => setDialog(null)}
          onPosted={() => data.reload()}
        />
      )}
    </main>
  );
}

