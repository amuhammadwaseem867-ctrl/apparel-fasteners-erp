"use client";

/*
 * The order form, in the sequence the requirements give (1.2, section 6):
 * Customer, Customer PO Number, Order No, then per line Product, Variant,
 * Finish, Type, Tape Color, Slider, plus Size, Unit and Quantity from the
 * AF7 order sheet. A rate is optional and only used for the invoice;
 * production documents never show it.
 *
 * mode="invoice" (D-048) is the invoice made first: the same sheet with a
 * rate on every line, sales tax 18% or non sales tax, and payment terms.
 * Saving makes the draft invoice and its order under the next AF7-YY-NNNN
 * number; approving the invoice later sends the order to Orders.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";

import Button from "@/components/ui/Button";
import { SLIDER_SPECS, TOP_STOP_FINISHES, UNITS } from "@/config/items";
import { apiRequest } from "@/lib/api/client";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { Y_CUT, isSize45 } from "@/lib/orders/teeth-rules";
import { formatAmount } from "@/lib/formatters/formatters";

import "@/components/inventory/InventoryWorkspace.css";
import "./OrderSheetForm.css";

const FINISHES = [...new Set(Object.values(TOP_STOP_FINISHES).flat())];
const SLIDERS = [...new Set(SLIDER_SPECS.map(([sizeType]) => sizeType))];
const TEETH_TYPES = ["Plain Teeth", Y_CUT];


const blankLine = () => ({ key: crypto.randomUUID(), product: "", variant: "", finish: "", teethType: "Plain Teeth", tapeColor: "", slider: "", size: "", unit: "Pcs", quantity: "", unitPrice: "" });
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function fromOrder(order) {
  return {
    header: { customerId: order.customerId, customerPo: order.customerPo ?? "", orderNumber: order.orderNumber, orderDate: order.orderDate, deliveryDate: order.deliveryDate ?? "", notes: order.notes ?? "" },
    lines: order.lines.map((line) => ({
      key: line.id, product: line.productName, variant: line.variant ?? "", finish: line.finish ?? "", teethType: line.teethType ?? "", tapeColor: line.tapeColor ?? "",
      slider: line.slider ?? "", size: line.size ?? "", unit: line.unit, quantity: String(line.quantity), unitPrice: line.unitPrice ? String(line.unitPrice) : "",
    })),
  };
}

const SALES_TAX = 18;
const daysBetween = (from, to) => Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000));

export default function OrderSheetForm({ orderId, invoiceId, mode = "order" }) {
  const invoice = useApiData(invoiceId ? `/api/finance/invoices/${encodeURIComponent(invoiceId)}` : null);
  const loadOrderId = orderId ?? invoice.data?.salesOrderId;
  const order = useApiData(loadOrderId ? `/api/sales/orders/${encodeURIComponent(loadOrderId)}` : null);
  if (!orderId && !invoiceId) return <SheetEditor mode={mode} />;
  if (!order.data) {
    const failed = invoice.error || order.error;
    return <main className="inv-page">{failed ? <p className="inv-dialog__error" role="alert">{failed}</p> : <p className="inv-state" role="status">Loading…</p>}</main>;
  }
  const invoiceTerms = invoice.data ? {
    id: invoice.data.id,
    invoiceType: invoice.data.invoiceType,
    paymentTermsDays: String(daysBetween(invoice.data.invoiceDate, invoice.data.dueDate)),
  } : null;
  return <SheetEditor mode={mode} orderId={invoiceId ? undefined : orderId} invoiceTerms={invoiceTerms} initial={fromOrder(order.data)} orderCustomer={order.data.customer} />;
}

function SheetEditor({ mode, orderId, invoiceTerms = null, initial, orderCustomer = null }) {
  const router = useRouter();
  const asInvoice = mode === "invoice";
  const editing = Boolean(orderId || invoiceTerms?.id);
  const [terms, setTerms] = useState(() => invoiceTerms ?? { invoiceType: "SALES_TAX", paymentTermsDays: "30" });
  const [key] = useState(() => crypto.randomUUID());
  const [header, setHeader] = useState(() => initial?.header ?? { customerId: "", customerPo: "", orderNumber: "", orderDate: today(), deliveryDate: "", notes: "" });
  const [lines, setLines] = useState(() => initial?.lines ?? [blankLine()]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const customers = useApiData(`/api/customers${toQuery({ search: customerSearch, pageSize: 100 })}`);

  // The order's own customer stays choosable even when the search hides it.
  const customerOptions = useMemo(() => {
    const listed = customers.data?.customers ?? [];
    return orderCustomer && !listed.some((customer) => customer.id === orderCustomer.id) ? [orderCustomer, ...listed] : listed;
  }, [customers.data, orderCustomer]);
  const totalQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
  const tax = terms.invoiceType === "SALES_TAX" ? Math.round(subtotal * SALES_TAX) / 100 : 0;
  const setField = (field) => (event) => setHeader((current) => ({ ...current, [field]: event.target.value }));
  // A #4.5 zipper is always Y-Cut: naming one sets the type.
  const setLine = (key, field, value) => setLines((current) => current.map((line) => {
    if (line.key !== key) return line;
    const next = { ...line, [field]: value };
    return isSize45(next.product) ? { ...next, teethType: Y_CUT } : next;
  }));

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const body = {
      ...header,
      lines: lines.map(({ key, quantity, unitPrice, ...line }) => ({ ...line, quantity: Number(quantity), unitPrice: unitPrice === "" ? 0 : Number(unitPrice) })),
    };
    try {
      if (asInvoice) {
        // The number is the system's: the server ignores what the sheet says.
        const sheet = body;
        const saved = await apiRequest(invoiceTerms?.id ? `/api/finance/invoices/${invoiceTerms.id}/manual` : "/api/finance/invoices/manual", {
          method: invoiceTerms?.id ? "PUT" : "POST",
          body: JSON.stringify({ idempotencyKey: key, invoiceType: terms.invoiceType, paymentTermsDays: Number(terms.paymentTermsDays || 0), sheet }),
        });
        router.push(`/finance/invoices/${saved.id}`);
        return;
      }
      const order = await apiRequest(editing ? `/api/sales/order-sheet/${orderId}` : "/api/sales/order-sheet", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      router.push(`/sales/orders/${order.id}`);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">{asInvoice ? "Invoices" : "1. Orders"}</p>
          <h1>{asInvoice ? (editing ? `Edit invoice ${header.orderNumber}` : "New invoice") : editing ? `Edit order ${header.orderNumber}` : "New order"}</h1>
          <p>{asInvoice
            ? "Fill the order sheet with the rate for every line. Approving the invoice makes the order; the production copy is printed without rates."
            : "Fill the order sheet. Prices are optional here and never appear on the production copy."}</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href={asInvoice ? (invoiceTerms?.id ? `/finance/invoices/${invoiceTerms.id}` : "/finance/invoices") : editing ? `/sales/orders/${orderId}` : "/sales/orders"}>Cancel</Link>
        </div>
      </header>

      <form onSubmit={save}>
        <section className="inv-card os-head">
          <div className="inv-field os-customer">
            <label htmlFor="os-customer">1. Customer name *</label>
            <input id="os-customer-search" type="search" placeholder="Search customer…" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} aria-label="Search customer" />
            <select id="os-customer" required value={header.customerId} onChange={setField("customerId")}>
              <option value="">Choose the customer</option>
              {customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            <small><Link href="/sales/customers">Add a new customer</Link></small>
          </div>
          <div className="inv-field"><label htmlFor="os-po">2. Customer PO number</label><input id="os-po" maxLength={80} value={header.customerPo} onChange={setField("customerPo")} /></div>
          {asInvoice ? (
            <div className="inv-field"><label htmlFor="os-no">3. Invoice / order no</label><input id="os-no" readOnly value={header.orderNumber || "Given by the system: AF7-YY-0001…"} /></div>
          ) : (
            <div className="inv-field"><label htmlFor="os-no">3. Order no</label><input id="os-no" maxLength={40} placeholder="Automatic if empty, e.g. AF7-26-0001" value={header.orderNumber} onChange={setField("orderNumber")} disabled={editing} /></div>
          )}
          <div className="inv-field"><label htmlFor="os-date">{asInvoice ? "Invoice date *" : "Order date *"}</label><input id="os-date" type="date" required value={header.orderDate} onChange={setField("orderDate")} /></div>
          <div className="inv-field"><label htmlFor="os-delivery">Required delivery date</label><input id="os-delivery" type="date" min={header.orderDate} value={header.deliveryDate} onChange={setField("deliveryDate")} /></div>
          {asInvoice && (
            <>
              <div className="inv-field">
                <label htmlFor="os-type">Invoice type *</label>
                <select id="os-type" value={terms.invoiceType} onChange={(event) => setTerms((current) => ({ ...current, invoiceType: event.target.value }))}>
                  <option value="SALES_TAX">Sales tax invoice (GST 18%)</option>
                  <option value="NON_TAX">Non sales tax invoice</option>
                </select>
              </div>
              <div className="inv-field"><label htmlFor="os-terms">Payment terms (days)</label><input id="os-terms" type="number" min="0" max="365" step="1" value={terms.paymentTermsDays} onChange={(event) => setTerms((current) => ({ ...current, paymentTermsDays: event.target.value }))} /></div>
            </>
          )}
        </section>

        <section className="inv-card">
          <div className="os-lines-head">
            <h2>Order sheet</h2>
            <span>{lines.length} line{lines.length === 1 ? "" : "s"} · {totalQuantity.toLocaleString()} total</span>
          </div>
          <div className="inv-table-wrap">
            <table className="inv-table os-lines">
              <thead>
                <tr>
                  <th>#</th><th>4. Product *</th><th>5. Variant</th><th>6. Finish</th><th>7. Type</th><th>8. Tape color</th><th>9. Slider</th><th>Size</th><th>Unit</th><th className="inv-num">Qty *</th><th className="inv-num">{asInvoice ? "Rate *" : "Rate (optional)"}</th>{asInvoice && <th className="inv-num">Amount</th>}<th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.key}>
                    <td data-label="#">{index + 1}</td>
                    <td data-label="Product"><input required maxLength={120} placeholder="#5 Metal Zipper Open End" value={line.product} onChange={(event) => setLine(line.key, "product", event.target.value)} /></td>
                    <td data-label="Variant"><input maxLength={120} placeholder="Right Insert" value={line.variant} onChange={(event) => setLine(line.key, "variant", event.target.value)} /></td>
                    <td data-label="Finish"><input list="os-finishes" maxLength={120} value={line.finish} onChange={(event) => setLine(line.key, "finish", event.target.value)} /></td>
                    <td data-label="Type">
                      <select value={line.teethType} disabled={isSize45(line.product)} title={isSize45(line.product) ? "#4.5 zippers are always Y-Cut" : undefined} onChange={(event) => setLine(line.key, "teethType", event.target.value)}>
                        <option value="">—</option>
                        {TEETH_TYPES.map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </td>
                    <td data-label="Tape color"><input maxLength={120} placeholder="Black same as fabric" value={line.tapeColor} onChange={(event) => setLine(line.key, "tapeColor", event.target.value)} /></td>
                    <td data-label="Slider"><input list="os-sliders" maxLength={120} placeholder="Picture puller" value={line.slider} onChange={(event) => setLine(line.key, "slider", event.target.value)} /></td>
                    <td data-label="Size"><input maxLength={60} placeholder="32 Inch" value={line.size} onChange={(event) => setLine(line.key, "size", event.target.value)} /></td>
                    <td data-label="Unit">
                      <select value={line.unit} onChange={(event) => setLine(line.key, "unit", event.target.value)}>
                        {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                      </select>
                    </td>
                    <td data-label="Qty" className="inv-num"><input required type="number" min="0.001" step="any" inputMode="decimal" value={line.quantity} onChange={(event) => setLine(line.key, "quantity", event.target.value)} /></td>
                    <td data-label="Rate" className="inv-num"><input type="number" min={asInvoice ? "0.000001" : "0"} required={asInvoice} step="any" inputMode="decimal" placeholder="0" value={line.unitPrice} onChange={(event) => setLine(line.key, "unitPrice", event.target.value)} /></td>
                    {asInvoice && <td data-label="Amount" className="inv-num">{formatAmount((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}</td>}
                    <td data-label="" className="os-row-actions">
                      <button type="button" className="os-icon-button" title="Copy this line (e.g. for another tape colour)" aria-label="Copy line" onClick={() => setLines((current) => [...current.slice(0, index + 1), { ...line, key: crypto.randomUUID(), tapeColor: "", quantity: "" }, ...current.slice(index + 1)])}><Copy size={15} /></button>
                      {lines.length > 1 && <button type="button" className="os-icon-button" title="Remove line" aria-label="Remove line" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 size={15} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="os-finishes">{FINISHES.map((finish) => <option key={finish} value={finish} />)}</datalist>
          <datalist id="os-sliders">{SLIDERS.map((slider) => <option key={slider} value={slider} />)}</datalist>
          <Button variant="secondary" onClick={() => setLines((current) => [...current, blankLine()])}><Plus size={15} /> Add line</Button>
          {asInvoice && (
            <table className="af7-totals os-totals">
              <tbody>
                <tr><th>Amount before tax</th><td>{formatAmount(subtotal)}</td></tr>
                <tr><th>{terms.invoiceType === "SALES_TAX" ? "Sales tax 18%" : "Sales tax"}</th><td>{terms.invoiceType === "SALES_TAX" ? formatAmount(tax) : "None"}</td></tr>
                <tr><th>Total</th><td>{formatAmount(subtotal + tax)}</td></tr>
              </tbody>
            </table>
          )}
          <div className="inv-field os-notes"><label htmlFor="os-notes">Remarks / special instructions</label><textarea id="os-notes" rows={2} maxLength={4000} value={header.notes} onChange={setField("notes")} /></div>
        </section>

        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="os-actions">
          <Button type="submit" variant="primary" loading={saving}>{asInvoice ? "Save invoice" : "Save order"}</Button>
        </div>
      </form>
    </main>
  );
}
