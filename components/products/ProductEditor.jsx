"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { suggestSku } from "@/lib/inventory/sku";
import { UNITS } from "@/config/items";
import "./ProductEditor.css";

const EMPTY_PRODUCT = {
  sku: "",
  name: "",
  description: "",
  category: "",
  productType: "",
  variant: "",
  unit: "",
  unitPrice: "0.00",
  status: "ACTIVE",
  size: "",
  material: "",
  itemType: "",
  finish: "",
  color: "",
  logoType: "",
  barcode: "",
  minimumStock: "0",
  unitWeightGrams: "",
};

// [key, label, type, required]
const FIELDS = [
  ["sku", "SKU", "text", true],
  ["name", "Product name", "text", true],
  ["category", "Category", "text", true],
  ["productType", "Product type", "text", true],
  ["variant", "Variant", "text", false],
  ["unitPrice", "Unit price", "number", true],
];

// Item master specification: each distinct combination is its own SKU.
const SPEC_FIELDS = [
  ["size", "Size", "e.g. #5, #4.5, 620 SS"],
  ["material", "Material", "e.g. Brass, Aluminium, Zinc"],
  ["itemType", "Type", "e.g. Plain, Y-Cut, DA, Thumb"],
  ["finish", "Finish", "e.g. Antique Silver, Golden Brass"],
  ["color", "Colour", ""],
  ["barcode", "Barcode / QR", "Optional, unique"],
];

const LOGO_OPTIONS = ["", "Plain", "Logo", "Standard"];

export default function ProductEditor({ productId, initial }) {
  const router = useRouter();
  const editing = Boolean(productId);
  const [form, setForm] = useState(() => ({ ...EMPTY_PRODUCT, ...initial }));
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    let active = true;
    apiRequest(`/api/products/${encodeURIComponent(productId)}`)
      .then((product) => {
        if (!active) return;
        setForm({
          sku: product.sku,
          name: product.name,
          description: product.description || "",
          category: product.category,
          productType: product.productType,
          variant: product.variant || "",
          unit: product.unit,
          unitPrice: String(product.unitPrice),
          status: product.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          size: product.size || "",
          material: product.material || "",
          itemType: product.itemType || "",
          finish: product.finish || "",
          color: product.color || "",
          logoType: product.logoType || "",
          barcode: product.barcode || "",
          minimumStock: String(product.minimumStock ?? 0),
          unitWeightGrams: product.unitWeightGrams == null ? "" : String(product.unitWeightGrams),
        });
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editing, productId]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const unitPrice = Number(form.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("Unit price must be a valid non-negative amount.");
      return;
    }
    const minimumStock = Number(form.minimumStock || 0);
    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      setError("Minimum stock must be zero or more.");
      return;
    }
    const unitWeightGrams = form.unitWeightGrams === "" ? null : Number(form.unitWeightGrams);
    if (unitWeightGrams !== null && (!Number.isFinite(unitWeightGrams) || unitWeightGrams <= 0)) {
      setError("Unit weight must be more than zero, or left empty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const product = await apiRequest(
        editing ? `/api/products/${encodeURIComponent(productId)}` : "/api/products",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({ ...form, unitPrice, minimumStock, unitWeightGrams }),
        },
      );
      router.push(`/products/${product.id}`);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="product-editor__state" role="status">Loading product…</p>;
  }

  return (
    <main className="product-editor">
      <header className="product-editor__header">
        <div>
          <p>PRODUCT MASTER</p>
          <h1>{editing ? "Edit product" : "Create product"}</h1>
          <span>Catalog details used by inventory and sales order lines.</span>
        </div>
        <Link href={editing ? `/products/${productId}` : "/products"}>Cancel</Link>
      </header>
      {error && <div className="product-editor__error" role="alert">{error}</div>}
      <form className="product-editor__form" onSubmit={submit}>
        <div className="product-editor__grid">
          {FIELDS.map(([key, label, type, required]) => (
            <label key={key}>
              <span>{label}{required ? " *" : ""}</span>
              <input
                required={required}
                type={type}
                min={type === "number" ? "0" : undefined}
                step={type === "number" ? "any" : undefined}
                value={form[key]}
                onChange={(event) => setField(key, event.target.value)}
              />
            </label>
          ))}
          <label>
            <span>Unit *</span>
            <input
              required
              list="product-editor-units"
              value={form.unit}
              onChange={(event) => setField("unit", event.target.value)}
            />
            <datalist id="product-editor-units">
              {UNITS.map((unit) => <option key={unit} value={unit} />)}
            </datalist>
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="product-editor__wide">
            <span>Description</span>
            <textarea
              rows={4}
              maxLength={4000}
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
            />
          </label>
        </div>
        <fieldset className="product-editor__spec">
          <legend>Item specification</legend>
          <p>
            Every distinct size, material, type, finish, colour and logo
            combination is a separate item with its own SKU and stock.
          </p>
          <div className="product-editor__grid">
            {SPEC_FIELDS.map(([key, label, placeholder]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(event) => setField(key, event.target.value)}
                />
              </label>
            ))}
            <label>
              <span>Logo / plain</span>
              <select value={form.logoType} onChange={(event) => setField("logoType", event.target.value)}>
                {LOGO_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option || "Not applicable"}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Minimum stock level</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.minimumStock}
                onChange={(event) => setField("minimumStock", event.target.value)}
              />
            </label>
            <label>
              <span>Unit weight (grams per piece)</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 0.35"
                value={form.unitWeightGrams}
                onChange={(event) => setField("unitWeightGrams", event.target.value)}
              />
            </label>
          </div>
          {!editing && (
            <button
              type="button"
              className="product-editor__suggest"
              onClick={() => setField("sku", suggestSku(form))}
              disabled={!form.category}
              title={form.category ? "Build the SKU from category and specification" : "Enter a category first"}
            >
              Suggest SKU from specification
            </button>
          )}
        </fieldset>
        <div className="product-editor__actions">
          <button type="button" disabled={saving} onClick={() => router.push("/products")}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create product"}</button>
        </div>
      </form>
    </main>
  );
}
