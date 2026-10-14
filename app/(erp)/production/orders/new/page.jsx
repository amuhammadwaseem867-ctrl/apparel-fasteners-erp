"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import Button from "@/components/ui/Button";
import ItemPicker from "@/components/inventory/ItemPicker";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/*
 * Creates a production order. Opened from an MRP run, the planned order's
 * id, item, quantity and due date are prefilled; the server converts each
 * confirmed MAKE planned order at most once.
 */
function NewProductionOrderForm() {
  const router = useRouter();
  const params = useSearchParams();
  const plannedOrderId = params.get("plannedOrderId") ?? "";
  const prefillProductId = params.get("productId") ?? "";
  const prefillProduct = useApiData(prefillProductId ? `/api/products/${prefillProductId}` : null);
  const salesOrders = useApiData("/api/sales/orders?status=APPROVED&pageSize=100");

  const [item, setItem] = useState(null);
  const [quantity, setQuantity] = useState(params.get("quantity") ?? "");
  const [dueDate, setDueDate] = useState(params.get("dueDate") ?? "");
  const [priority, setPriority] = useState("NORMAL");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loaded = prefillProduct.data?.product ?? prefillProduct.data;
  const prefilled = loaded?.id ? { id: loaded.id, sku: loaded.sku, name: loaded.name, unit: loaded.unit } : null;
  // A planned order fixes the item; otherwise the user's choice is used.
  const chosen = plannedOrderId ? prefilled : item ?? prefilled;

  const ready = chosen && Number(quantity) > 0;

  async function submit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const created = await apiRequest("/api/production/orders", {
        method: "POST",
        body: JSON.stringify({
          productId: chosen.id,
          quantity: Number(quantity),
          dueDate,
          priority,
          notes,
          ...(salesOrderId ? { salesOrderId } : {}),
          ...(plannedOrderId ? { plannedOrderId } : {}),
        }),
      });
      router.push(`/production/orders/${created.id}`);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Production</p>
          <h1>New Production Order</h1>
          <p>The order is created as Planned with all nine stages. Release it to start recording output. The item&apos;s active BOM revision is recorded on the order.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/production/orders">Back to orders</Link>
        </div>
      </header>

      <section className="inv-card">
        <form className="inv-dialog" onSubmit={submit} style={{ padding: 18 }}>
          {plannedOrderId && (
            <p className="inv-state" role="status">Converting a confirmed MRP planned order. The item is fixed; the quantity and due date can be adjusted.</p>
          )}
          <ItemPicker label="Item to produce" required value={chosen} onChange={setItem} disabled={Boolean(plannedOrderId)} />
          <div className="inv-dialog__grid">
            <div className="inv-field">
              <label htmlFor="prd-qty">Quantity *{chosen ? ` (${chosen.unit})` : ""}</label>
              <input id="prd-qty" type="number" step="any" min="0.000001" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
            <div className="inv-field">
              <label htmlFor="prd-due">Due date</label>
              <input id="prd-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="inv-field">
              <label htmlFor="prd-priority">Priority</label>
              <select id="prd-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="inv-field">
              <label htmlFor="prd-so">Sales order (approved)</label>
              <select id="prd-so" value={salesOrderId} onChange={(event) => setSalesOrderId(event.target.value)} disabled={!salesOrders.data}>
                <option value="">{salesOrders.error ? "Sales orders unavailable" : "None (make to stock)"}</option>
                {(salesOrders.data?.orders ?? []).map((order) => (
                  <option key={order.id} value={order.id}>{order.orderNumber} · {order.customerName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="inv-field">
            <label htmlFor="prd-notes">Notes</label>
            <textarea id="prd-notes" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {error && <p className="inv-dialog__error" role="alert">{error}</p>}
          <div className="inv-dialog__actions">
            <Button type="submit" variant="primary" loading={saving} disabled={!ready}>Create production order</Button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function NewProductionOrderPage() {
  return (
    <Suspense fallback={<p className="inv-state" role="status">Loading…</p>}>
      <NewProductionOrderForm />
    </Suspense>
  );
}
