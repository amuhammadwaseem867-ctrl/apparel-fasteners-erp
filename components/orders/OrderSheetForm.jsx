"use client";

/*
 * The order form, in the sequence the requirements give (1.2, section 6):
 * Customer, Customer PO Number, Order No, then per line Product, Variant,
 * Finish, Type, Tape Color, Slider, plus Size, Unit and Quantity from the
 * AF7 order sheet. A rate is optional and only used for the invoice;
 * production documents never show it.
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

export default function OrderSheetForm({ orderId }) {
  const order = useApiData(orderId ? `/api/sales/orders/${encodeURIComponent(orderId)}` : null);
  if (!orderId) return <SheetEditor />;
  if (!order.data) {
    return <main className="inv-page">{order.error ? <p className="inv-dialog__error" role="alert">{order.error}</p> : <p className="inv-state" role="status">Loading order…</p>}</main>;
  }
  return <SheetEditor orderId={orderId} initial={fromOrder(order.data)} orderCustomer={order.data.customer} />;
}

function SheetEditor({ orderId, initial, orderCustomer = null }) {
  const router = useRouter();
  const editing = Boolean(orderId);
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
          <p className="inv-header__eyebrow">1. Orders</p>
          <h1>{editing ? `Edit order ${header.orderNumber}` : "New order"}</h1>
          <p>Fill the order sheet. Prices are optional here and never appear on the production copy.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href={editing ? `/sales/orders/${orderId}` : "/sales/orders"}>Cancel</Link>
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
          <div className="inv-field"><label htmlFor="os-no">3. Order no</label><input id="os-no" maxLength={40} placeholder="Automatic if empty, e.g. AF-26-1154" value={header.orderNumber} onChange={setField("orderNumber")} disabled={editing} /></div>
          <div className="inv-field"><label htmlFor="os-date">Order date *</label><input id="os-date" type="date" required value={header.orderDate} onChange={setField("orderDate")} /></div>
          <div className="inv-field"><label htmlFor="os-delivery">Required delivery date</label><input id="os-delivery" type="date" min={header.orderDate} value={header.deliveryDate} onChange={setField("deliveryDate")} /></div>
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
                  <th>#</th><th>4. Product *</th><th>5. Variant</th><th>6. Finish</th><th>7. Type</th><th>8. Tape color</th><th>9. Slider</th><th>Size</th><th>Unit</th><th className="inv-num">Qty *</th><th className="inv-num">Rate (optional)</th><th />
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
                    <td data-label="Rate" className="inv-num"><input type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={line.unitPrice} onChange={(event) => setLine(line.key, "unitPrice", event.target.value)} /></td>
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
          <div className="inv-field os-notes"><label htmlFor="os-notes">Remarks / special instructions</label><textarea id="os-notes" rows={2} maxLength={4000} value={header.notes} onChange={setField("notes")} /></div>
        </section>

        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="os-actions">
          <Button type="submit" variant="primary" loading={saving}>Save order</Button>
        </div>
      </form>
    </main>
  );
}
