"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { apiRequest } from "@/lib/api/client";
import "./OrderEditor.css";

const emptySubscribe = () => () => {};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function moneyFromCents(cents) {
  return (cents / 100).toFixed(2);
}

function lineAmounts(line) {
  const grossCents = Math.round(Number(line.quantity || 0) * Number(line.unitPrice || 0) * 100);
  const discountCents = Math.round(grossCents * Number(line.discountPercent || 0) / 100);
  const taxCents = Math.round((grossCents - discountCents) * Number(line.taxPercent || 0) / 100);
  return {
    grossCents,
    discountCents,
    taxCents,
    totalCents: grossCents - discountCents + taxCents,
  };
}

function lineAmount(line) {
  return lineAmounts(line).totalCents / 100;
}

function createKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export default function OrderEditor({ orderId }) {
  const router = useRouter();
  const editing = Boolean(orderId);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  /*
   * Default the order date to today without reading the clock during
   * prerender: the server snapshot is empty (hydration-safe) and the
   * client snapshot supplies the live date.
   */
  const [orderDateInput, setOrderDate] = useState(null);
  const todayOrderDate = useSyncExternalStore(
    emptySubscribe,
    todayISO,
    () => ""
  );
  const orderDate = orderDateInput ?? todayOrderDate;
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({
    productName: "",
    customerReference: "",
    skuReference: "",
    category: "",
    variant: "",
    unit: "",
    quantity: "1",
    unitPrice: "0",
    notes: "",
  });
  const [loading, setLoading] = useState(editing);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [productError, setProductError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams({
          search: customerSearch,
          page: "1",
          pageSize: "100",
        });
        const response = await apiRequest(`/api/customers?${params}`);
        if (active) {
          setCustomers(response.customers);
          setCustomerError("");
        }
      } catch (cause) {
        if (active) setCustomerError(cause.message);
      }
    };
    void load();
    return () => { active = false; };
  }, [customerSearch]);

  useEffect(() => {
    if (!editing) return;
    let active = true;
    apiRequest(`/api/sales/orders/${encodeURIComponent(orderId)}`)
      .then((order) => {
        if (!active) return;
        setCustomers((current) => [
          order.customer,
          ...current.filter((customer) => customer.id !== order.customer.id),
        ]);
        setCustomerId(order.customerId);
        setOrderDate(order.orderDate);
        setDeliveryDate(order.deliveryDate || "");
        setNotes(order.notes || "");
        setLines(order.lines.map((line) => ({
          ...line,
          key: line.id,
          kind: line.isCustom ? "custom" : "catalog",
        })));
      })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editing, orderId]);

  useEffect(() => {
    if (!selectorOpen) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setProductsLoading(true);
      setProductError("");
      const params = new URLSearchParams({
        search: productSearch,
        category: categoryFilter,
        variant: variantFilter,
        status: "ACTIVE",
        page: "1",
        pageSize: "30",
      });
      try {
        const response = await apiRequest(`/api/products?${params}`);
        if (active) setProducts(response.products);
      } catch (cause) {
        if (active) setProductError(cause.message);
      } finally {
        if (active) setProductsLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectorOpen, productSearch, categoryFilter, variantFilter]);

  const totals = useMemo(() => lines.reduce((sum, line) => {
    const amount = lineAmounts(line);
    sum.subtotal += amount.grossCents;
    sum.discount += amount.discountCents;
    sum.tax += amount.taxCents;
    sum.total += amount.totalCents;
    return sum;
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 }), [lines]);

  function updateLine(key, field, value) {
    setLines((current) => current.map((line) =>
      line.key === key ? { ...line, [field]: value } : line,
    ));
  }

  function addCatalogProduct(product) {
    setLines((current) => [...current, {
      key: createKey(),
      kind: "catalog",
      productId: product.id,
      productName: product.name,
      skuReference: product.sku,
      category: product.category,
      variant: product.variant || "",
      unit: product.unit,
      quantity: "1",
      unitPrice: String(product.unitPrice),
      discountPercent: "0",
      taxPercent: "0",
      notes: "",
    }]);
    setSelectorOpen(false);
  }

  function addCustomProduct(event) {
    event.preventDefault();
    setLines((current) => [...current, {
      key: createKey(),
      kind: "custom",
      ...custom,
      discountPercent: "0",
      taxPercent: "0",
    }]);
    setCustomOpen(false);
    setSelectorOpen(false);
    setCustom({
      productName: "",
      customerReference: "",
      skuReference: "",
      category: "",
      variant: "",
      unit: "",
      quantity: "1",
      unitPrice: "0",
      notes: "",
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (lines.length === 0) {
      setError("Add at least one order line.");
      return;
    }
    setSaving(true);
    const payload = {
      customerId,
      orderDate,
      deliveryDate,
      notes,
      lines: lines.map((line) => ({
        kind: line.kind,
        ...(line.kind === "catalog"
          ? { productId: line.productId }
          : {
              productName: line.productName,
              customerReference: line.customerReference,
              skuReference: line.skuReference,
              category: line.category,
              variant: line.variant,
              unit: line.unit,
            }),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountPercent: Number(line.discountPercent || 0),
        taxPercent: Number(line.taxPercent || 0),
        notes: line.notes || "",
      })),
    };
    try {
      const order = await apiRequest(
        editing ? `/api/sales/orders/${encodeURIComponent(orderId)}` : "/api/sales/orders",
        { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      router.push(`/sales/orders/${order.id}`);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  if (loading) return <main className="order-editor"><p role="status">Loading sales orderâ€¦</p></main>;

  return (
    <main className="order-editor">
      <header className="order-editor__header">
        <div>
          <p>SALES / ORDERS</p>
          <h1>{editing ? "Edit sales order" : "New sales order"}</h1>
          <span>Catalog products and custom order items are stored as distinct line types.</span>
        </div>
        <Link href="/sales/orders">Back to orders</Link>
      </header>
      {error && <div className="order-editor__error" role="alert">{error}</div>}

      <form onSubmit={submit}>
        <section className="order-editor__section">
          <h2>Order information</h2>
          <div className="order-editor__header-fields">
            <label>
              <span>Customer *</span>
              <input
                type="search"
                aria-label="Search customers"
                placeholder="Search active customers"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />
              <select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.code} â€” {customer.name}</option>
                ))}
              </select>
              {customerError && <small className="order-editor__inline-error">{customerError}</small>}
              {!customerError && !customers.length && (
                <small>No matching customers. <Link href="/sales/customers">Create a customer</Link></small>
              )}
            </label>
            <label><span>Order date *</span><input type="date" required value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></label>
            <label><span>Delivery date</span><input type="date" min={orderDate} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
            <label className="order-editor__notes"><span>Order notes</span><textarea rows="2" maxLength="4000" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
        </section>

        <section className="order-editor__section">
          <div className="order-editor__section-title">
            <div><h2>Order lines</h2><span>{lines.length} item{lines.length === 1 ? "" : "s"}</span></div>
            <button type="button" className="order-editor__add" onClick={() => setSelectorOpen(true)}>+ Add product</button>
          </div>
          <div className="order-editor__table-scroll">
            <table className="order-editor__table">
              <colgroup>
                <col style={{ width: "52px" }} />
                <col style={{ width: "300px" }} />
                <col style={{ width: "180px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "82px" }} />
                <col style={{ width: "82px" }} />
                <col style={{ width: "125px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "99px" }} />
              </colgroup>
              <thead>
                <tr><th>#</th><th>Product / description</th><th>SKU / reference</th><th>Category / variant</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Discount %</th><th>Tax %</th><th className="order-editor__numeric">Line total</th><th /></tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.key}>
                    <td>{index + 1}</td>
                    <td className="order-editor__product-name">
                      {line.kind === "custom" && <span className="order-editor__custom-tag">CUSTOM</span>}
                      <strong>{line.productName}</strong>
                      {line.customerReference && <small>{line.customerReference}</small>}
                    </td>
                    <td>{line.skuReference || "â€”"}</td>
                    <td>{[line.category, line.variant].filter(Boolean).join(" / ") || "â€”"}</td>
                    <td><input className="order-editor__number" aria-label={`Quantity for ${line.productName}`} type="number" min="0.001" step="0.001" required value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} /></td>
                    <td>{line.unit}</td>
                    <td><input className="order-editor__number" aria-label={`Unit price for ${line.productName}`} type="number" min="0" step="0.01" required value={line.unitPrice} onChange={(event) => updateLine(line.key, "unitPrice", event.target.value)} /></td>
                    <td><input className="order-editor__percent" aria-label={`Discount percentage for ${line.productName}`} type="number" min="0" max="100" step="1" value={line.discountPercent} onChange={(event) => updateLine(line.key, "discountPercent", event.target.value)} /></td>
                    <td><input className="order-editor__percent" aria-label={`Tax percentage for ${line.productName}`} type="number" min="0" max="100" step="1" value={line.taxPercent} onChange={(event) => updateLine(line.key, "taxPercent", event.target.value)} /></td>
                    <td className="order-editor__numeric">{lineAmount(line).toFixed(2)}</td>
                    <td><button className="order-editor__remove" type="button" aria-label={`Remove ${line.productName}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Remove</button></td>
                  </tr>
                ))}
                {!lines.length && <tr><td colSpan="11" className="order-editor__empty">No order lines yet. Add a catalog product or custom order item.</td></tr>}
              </tbody>
            </table>
          </div>
          {lines.some((line) => line.kind === "custom") && (
            <p className="order-editor__custom-note">CUSTOM lines are order-specific items; no Product Master record or stock is created.</p>
          )}
          <div className="order-editor__totals">
            <div><span>Subtotal</span><strong>{moneyFromCents(totals.subtotal)}</strong></div>
            <div><span>Discount</span><strong>{moneyFromCents(totals.discount)}</strong></div>
            <div><span>Tax</span><strong>{moneyFromCents(totals.tax)}</strong></div>
            <div className="order-editor__grand-total"><span>Order total</span><strong>{moneyFromCents(totals.total)}</strong></div>
          </div>
        </section>

        <footer className="order-editor__footer">
          <Link href="/sales/orders">Cancel</Link>
          <button type="submit" disabled={saving || !customerId}>{saving ? "Savingâ€¦" : editing ? "Save order" : "Create sales order"}</button>
        </footer>
      </form>

      {selectorOpen && (
        <div className="order-editor__overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectorOpen(false); }}>
          <section className="order-editor__dialog" role="dialog" aria-modal="true" aria-labelledby="product-selector-title">
            <header><div><h2 id="product-selector-title">Add product</h2><p>Choose an active catalog product or add an order-only custom item.</p></div><button type="button" aria-label="Close product selector" onClick={() => setSelectorOpen(false)}>Ã—</button></header>
            <div className="order-editor__product-filters">
              <input autoFocus type="search" placeholder="Search product, SKU, category or variant" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
              <input placeholder="Filter category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} />
              <input placeholder="Filter variant" value={variantFilter} onChange={(event) => setVariantFilter(event.target.value)} />
            </div>
            <div className="order-editor__product-list">
              {productsLoading && <p role="status">Searching catalogâ€¦</p>}
              {!productsLoading && productError && <p role="alert" className="order-editor__inline-error">{productError}</p>}
              {!productsLoading && !productError && products.length === 0 && <p>No active catalog products found.</p>}
              {!productsLoading && products.map((product) => (
                <div className="order-editor__product-option" key={product.id}>
                  <div><strong>{product.sku}</strong><span>{product.name}</span><small>{product.category}{product.variant ? ` Â· ${product.variant}` : ""} Â· {product.unit} Â· Stock not configured</small></div>
                  <div className="order-editor__product-price"><strong>{Number(product.unitPrice).toFixed(2)}</strong><button type="button" onClick={() => addCatalogProduct(product)}>Add</button></div>
                </div>
              ))}
            </div>
            <button type="button" className="order-editor__custom-open" onClick={() => { setCustomOpen(true); setSelectorOpen(false); }}>+ Add custom product</button>
          </section>
        </div>
      )}

      {customOpen && (
        <div className="order-editor__overlay" role="presentation">
          <form className="order-editor__dialog order-editor__custom-dialog" onSubmit={addCustomProduct} role="dialog" aria-modal="true" aria-labelledby="custom-product-title">
            <header><div><h2 id="custom-product-title">Add custom order item</h2><p>This item belongs only to this order and will not create a catalog product.</p></div><button type="button" aria-label="Close custom item form" onClick={() => setCustomOpen(false)}>Ã—</button></header>
            <div className="order-editor__custom-fields">
              {[
                ["productName", "Product name / description", true],
                ["customerReference", "Customer reference / description", false],
                ["skuReference", "SKU / reference", false],
                ["category", "Category", false],
                ["variant", "Variant", false],
                ["unit", "Unit", true],
                ["quantity", "Quantity", true],
                ["unitPrice", "Unit price", true],
              ].map(([key, label, required]) => (
                <label key={key}><span>{label}{required ? " *" : ""}</span><input required={required} type={key === "quantity" || key === "unitPrice" ? "number" : "text"} min={key === "quantity" || key === "unitPrice" ? "0" : undefined} step={key === "quantity" ? "0.001" : key === "unitPrice" ? "0.01" : undefined} value={custom[key]} onChange={(event) => setCustom((current) => ({ ...current, [key]: event.target.value }))} /></label>
              ))}
              <label className="order-editor__notes"><span>Notes / specification</span><textarea rows="3" maxLength="1000" value={custom.notes} onChange={(event) => setCustom((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>
            <footer><button type="button" onClick={() => setCustomOpen(false)}>Cancel</button><button type="submit">Add custom item</button></footer>
          </form>
        </div>
      )}
    </main>
  );
}




