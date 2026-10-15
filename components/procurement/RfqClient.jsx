"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ProcStatusBadge, SupplierSelect, formatAmount, newKey } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function QuoteDialog({ rfq, onClose, onSaved }) {
  const suppliers = useApiData("/api/procurement/suppliers?status=ACTIVE&pageSize=200");
  const [supplierId, setSupplierId] = useState("");
  const [values, setValues] = useState({ quoteRef: "", validUntil: "", leadTimeDays: "", taxPercent: "0", notes: "" });
  const [prices, setPrices] = useState(() => Object.fromEntries(rfq.lines.map((line) => [line.id, ""])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const valid = supplierId && rfq.lines.every((line) => prices[line.id] !== "" && Number(prices[line.id]) >= 0);

  function pickSupplier(id) {
    setSupplierId(id);
    const existing = rfq.quotes.find((quote) => quote.supplierId === id);
    if (existing) {
      setPrices(Object.fromEntries(existing.prices.map((price) => [price.rfqLineId, price.unitPrice])));
      setValues({ quoteRef: existing.quoteRef ?? "", validUntil: existing.validUntil ?? "", leadTimeDays: existing.leadTimeDays ?? "", taxPercent: String(existing.taxPercent), notes: existing.notes ?? "" });
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/procurement/rfqs/${rfq.id}/quotes`, {
        method: "POST",
        body: JSON.stringify({
          supplierId, quoteRef: values.quoteRef, validUntil: values.validUntil, notes: values.notes, taxPercent: Number(values.taxPercent || 0),
          ...(values.leadTimeDays === "" ? {} : { leadTimeDays: Number(values.leadTimeDays) }),
          prices: rfq.lines.map((line) => ({ rfqLineId: line.id, unitPrice: Number(prices[line.id]) })),
        }),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Record a quote for ${rfq.rfqNumber}`} description="Recording a quote again for the same supplier replaces it while the RFQ is open." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <SupplierSelect id="q-supplier" suppliers={suppliers.data?.suppliers ?? []} value={supplierId} onChange={pickSupplier} />
          <div className="inv-field"><label htmlFor="q-ref">Supplier quote ref.</label><input id="q-ref" maxLength={80} value={values.quoteRef} onChange={set("quoteRef")} /></div>
          <div className="inv-field"><label htmlFor="q-valid">Valid until</label><input id="q-valid" type="date" value={values.validUntil} onChange={set("validUntil")} /></div>
          <div className="inv-field"><label htmlFor="q-lead">Lead time (days)</label><input id="q-lead" type="number" min="0" max="365" step="1" value={values.leadTimeDays} onChange={set("leadTimeDays")} /></div>
          <div className="inv-field"><label htmlFor="q-tax">Tax %</label><input id="q-tax" type="number" min="0" max="100" step="1" value={values.taxPercent} onChange={set("taxPercent")} /></div>
        </div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Item</th><th className="inv-num">Quantity</th><th>Unit price *</th></tr></thead>
            <tbody>
              {rfq.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                  <td data-label="Quantity" className="inv-num">{line.quantity} {line.unit}</td>
                  <td data-label="Unit price"><input aria-label={`Quoted price ${line.sku}`} type="number" min="0" step="any" required value={prices[line.id]} onChange={(event) => setPrices((current) => ({ ...current, [line.id]: event.target.value }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inv-field"><label htmlFor="q-notes">Notes</label><textarea id="q-notes" rows={2} maxLength={500} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Save quote</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RfqClient({ id }) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const result = useApiData(`/api/procurement/rfqs/${encodeURIComponent(id)}`);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [awardKey] = useState(newKey);
  const data = result.data;

  async function award(quote) {
    if (!window.confirm(`Award ${data.rfqNumber} to ${quote.supplierName} for ${formatAmount(quote.totalAmount)}? A draft purchase order will be raised.`)) return;
    setBusy(quote.id);
    setError("");
    try {
      const order = await apiRequest(`/api/procurement/rfqs/${id}/award`, { method: "POST", body: JSON.stringify({ quoteId: quote.id, idempotencyKey: awardKey }) });
      router.push(`/procurement/purchase-orders/${order.id}`);
    } catch (cause) {
      setError(cause.message);
      setBusy("");
    }
  }

  async function cancel() {
    if (!window.confirm(`Cancel ${data.rfqNumber}?`)) return;
    setBusy("cancel");
    setError("");
    try {
      await apiRequest(`/api/procurement/rfqs/${id}`, { method: "DELETE" });
      result.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (result.error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{result.error}</p><Link href="/procurement/rfqs">Back to RFQs</Link></main>;
  if (!data) return <main className="inv-page"><p className="inv-state" role="status">Loading RFQ…</p></main>;
  const open = data.status === "OPEN";

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement/rfqs">RFQs</Link></p>
          <h1>{data.rfqNumber} <ProcStatusBadge status={data.status} /></h1>
          <p>{data.responseDue ? `Quotes due ${data.responseDue}. ` : ""}{data.notes || ""}{data.poNumber ? " Awarded: " : ""}{data.poNumber && <Link href={`/procurement/purchase-orders/${data.purchaseOrderId}`}>{data.poNumber}</Link>}</p>
        </div>
        <div className="inv-header__actions">
          {open && can("purchasing:create") && <Button variant="primary" onClick={() => setQuoting(true)}>Record quote</Button>}
          {open && can("purchasing:create") && <Button variant="secondary" loading={busy === "cancel"} onClick={cancel}>Cancel RFQ</Button>}
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <h2 style={{ padding: "12px 18px 0" }}>Quote comparison</h2>
        {data.quotes.length === 0 ? (
          <p className="inv-state">No quotes recorded yet.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Item</th><th className="inv-num">Qty</th>
                  {data.quotes.map((quote) => <th key={quote.id} className="inv-num">{quote.supplierName}{quote.id === data.awardedQuoteId ? " ★" : ""}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => {
                  const prices = data.quotes.map((quote) => Number(quote.prices.find((price) => price.rfqLineId === line.id)?.unitPrice));
                  const best = Math.min(...prices);
                  return (
                    <tr key={line.id}>
                      <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                      <td data-label="Qty" className="inv-num">{line.quantity} {line.unit}</td>
                      {data.quotes.map((quote, index) => (
                        <td key={quote.id} data-label={quote.supplierName} className="inv-num">{prices[index] === best ? <strong>{quote.prices.find((price) => price.rfqLineId === line.id)?.unitPrice}</strong> : quote.prices.find((price) => price.rfqLineId === line.id)?.unitPrice}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr><td colSpan={2}>Tax %</td>{data.quotes.map((quote) => <td key={quote.id} className="inv-num">{quote.taxPercent}</td>)}</tr>
                <tr><td colSpan={2}>Lead time</td>{data.quotes.map((quote) => <td key={quote.id} className="inv-num">{quote.leadTimeDays === null ? "—" : `${quote.leadTimeDays} days`}</td>)}</tr>
                <tr><td colSpan={2}>Valid until</td>{data.quotes.map((quote) => <td key={quote.id} className="inv-num">{quote.validUntil || "—"}</td>)}</tr>
                <tr><td colSpan={2}><strong>Total incl. tax</strong></td>{data.quotes.map((quote) => <td key={quote.id} className="inv-num"><strong>{formatAmount(quote.totalAmount)}</strong></td>)}</tr>
                {open && can("purchasing:approve") && (
                  <tr><td colSpan={2} />{data.quotes.map((quote) => <td key={quote.id} className="inv-num"><Button variant="primary" loading={busy === quote.id} disabled={Boolean(busy)} onClick={() => award(quote)}>Award</Button></td>)}</tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="inv-field__hint" style={{ padding: "8px 18px" }}>Quotes are ordered by total, lowest first; the lowest price per item is in bold.</p>
      </section>
      {quoting && <QuoteDialog rfq={data} onClose={() => setQuoting(false)} onSaved={() => { setQuoting(false); result.reload(); }} />}
    </main>
  );
}
