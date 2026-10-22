"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import ItemPicker from "@/components/inventory/ItemPicker";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function PricingPage() {
  const { can } = useCurrentUser();
  const manage = can("products:update");
  const categories = useApiData("/api/products/categories");
  const [item, setItem] = useState(null);
  const [single, setSingle] = useState({ unitPrice: "", effectiveDate: todayIso(), reason: "" });
  const [bulk, setBulk] = useState({ category: "", percent: "", effectiveDate: todayIso(), reason: "" });
  const [preview, setPreview] = useState(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ error: "", notice: "" });
  const history = useApiData(`/api/products/prices${toQuery({ productId: item?.id ?? "", page, pageSize: 50 })}`);

  async function run(label, work) {
    setBusy(label);
    setMessage({ error: "", notice: "" });
    try {
      await work();
    } catch (cause) {
      setMessage({ error: cause.message, notice: "" });
    } finally {
      setBusy("");
    }
  }

  const changeOne = (event) => {
    event.preventDefault();
    run("single", async () => {
      const result = await apiRequest("/api/products/prices", { method: "POST", body: JSON.stringify({ productId: item.id, unitPrice: Number(single.unitPrice), effectiveDate: single.effectiveDate, reason: single.reason }) });
      setMessage({ error: "", notice: `${result.sku}: ${result.previous} â†’ ${result.next}` });
      setItem({ ...item, unitPrice: result.next });
      setSingle({ ...single, unitPrice: "", reason: "" });
      history.reload();
    });
  };
  const bulkBody = (apply) => JSON.stringify({ ...bulk, percent: Number(bulk.percent), apply });
  const previewBulk = (event) => { event.preventDefault(); run("preview", async () => setPreview(await apiRequest("/api/products/prices/bulk", { method: "POST", body: bulkBody(false) }))); };
  const applyBulk = () => run("apply", async () => {
    const result = await apiRequest("/api/products/prices/bulk", { method: "POST", body: bulkBody(true) });
    setPreview(null);
    setMessage({ error: "", notice: `${result.changes.length} prices changed in ${bulk.category}.` });
    history.reload();
  });

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/products">Products</Link></p>
          <h1>Product pricing</h1>
          <p>List prices (up to 6 decimals, never silently rounded) with a full history of every change. New sales order lines default to the current price; existing orders keep theirs.</p>
        </div>
      </header>
      {message.error && <p className="inv-dialog__error" role="alert">{message.error}</p>}
      {message.notice && <p className="inv-field__hint" role="status">{message.notice}</p>}
      {manage && (
        <section className="inv-card">
          <div className="inv-card__header"><h2>Change one price</h2></div>
          <form className="inv-dialog" onSubmit={changeOne}>
            <ItemPicker label="Item" value={item} onChange={setItem} required />
            {item && <p className="inv-field__hint">Current price {item.unitPrice} per {item.unit}.</p>}
            <div className="inv-dialog__grid">
              <div className="inv-field"><label htmlFor="pp-price">New price *</label><input id="pp-price" type="number" min="0" step="any" required value={single.unitPrice} onChange={(event) => setSingle({ ...single, unitPrice: event.target.value })} /></div>
              <div className="inv-field"><label htmlFor="pp-date">Effective *</label><input id="pp-date" type="date" required value={single.effectiveDate} onChange={(event) => setSingle({ ...single, effectiveDate: event.target.value })} /></div>
              <div className="inv-field"><label htmlFor="pp-reason">Reason *</label><input id="pp-reason" required minLength={3} maxLength={300} value={single.reason} onChange={(event) => setSingle({ ...single, reason: event.target.value })} /></div>
            </div>
            <div className="inv-dialog__actions"><Button type="submit" variant="primary" loading={busy === "single"} disabled={!item}>Change price</Button></div>
          </form>
        </section>
      )}
      {manage && (
        <section className="inv-card">
          <div className="inv-card__header"><h2>Adjust a category by percentage</h2></div>
          <form className="inv-dialog" onSubmit={previewBulk}>
            <div className="inv-dialog__grid">
              <div className="inv-field">
                <label htmlFor="pb-cat">Category *</label>
                <select id="pb-cat" required value={bulk.category} onChange={(event) => { setBulk({ ...bulk, category: event.target.value }); setPreview(null); }}>
                  <option value="">Select category</option>
                  {(categories.data?.categories ?? []).map((row) => <option key={row.name} value={row.name}>{row.name} ({row.activeProducts})</option>)}
                </select>
              </div>
              <div className="inv-field"><label htmlFor="pb-pct">Change % *</label><input id="pb-pct" type="number" min="-90" max="500" step="0.01" required value={bulk.percent} onChange={(event) => { setBulk({ ...bulk, percent: event.target.value }); setPreview(null); }} /></div>
              <div className="inv-field"><label htmlFor="pb-date">Effective *</label><input id="pb-date" type="date" required value={bulk.effectiveDate} onChange={(event) => setBulk({ ...bulk, effectiveDate: event.target.value })} /></div>
              <div className="inv-field"><label htmlFor="pb-reason">Reason *</label><input id="pb-reason" required minLength={3} maxLength={300} value={bulk.reason} onChange={(event) => setBulk({ ...bulk, reason: event.target.value })} /></div>
            </div>
            <div className="inv-dialog__actions"><Button type="submit" variant="secondary" loading={busy === "preview"}>Preview</Button></div>
          </form>
          {preview && (
            <>
              {preview.changes.length === 0 ? <p className="inv-state">No active item in this category would change.</p> : (
                <div className="inv-table-wrap">
                  <table className="inv-table">
                    <thead><tr><th>Item</th><th className="inv-num">Current</th><th className="inv-num">New</th></tr></thead>
                    <tbody>{preview.changes.map((row) => <tr key={row.productId}><td data-label="Item">{row.sku}<small>{row.name}</small></td><td data-label="Current" className="inv-num">{row.current}</td><td data-label="New" className="inv-num">{row.proposed}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              {preview.changes.length > 0 && <div className="inv-dialog__actions" style={{ padding: "8px 18px" }}><Button variant="primary" loading={busy === "apply"} onClick={applyBulk}>Apply {preview.changes.length} changes</Button></div>}
            </>
          )}
        </section>
      )}
      <section className="inv-card">
        <div className="inv-card__header"><h2>Price history{item ? ` · ${item.sku}` : ""}</h2></div>
        {history.error ? <p className="inv-state inv-state--error" role="alert">{history.error}</p> : !history.data ? <p className="inv-state" role="status">Loadingâ€¦</p> : history.data.changes.length === 0 ? <p className="inv-state">No price changes recorded{item ? " for this item" : ""}.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Item</th><th className="inv-num">From</th><th className="inv-num">To</th><th>Effective</th><th>Reason</th><th>Changed</th></tr></thead>
              <tbody>
                {history.data.changes.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Item"><Link href={`/products/${row.productId}`}>{row.sku}</Link><small>{row.name}</small></td>
                    <td data-label="From" className="inv-num">{row.previousPrice}</td>
                    <td data-label="To" className="inv-num">{row.newPrice}</td>
                    <td data-label="Effective">{row.effectiveDate}</td>
                    <td data-label="Reason">{row.reason}</td>
                    <td data-label="Changed">{new Date(row.changedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}<small>{row.changedBy}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={history.data?.hasMore} onChange={setPage} disabled={history.loading} />
      </section>
    </main>
  );
}

