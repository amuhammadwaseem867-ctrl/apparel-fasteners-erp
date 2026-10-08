"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
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
};

const FIELDS = [
  ["sku", "SKU", "text"],
  ["name", "Product name", "text"],
  ["category", "Category", "text"],
  ["productType", "Product type", "text"],
  ["variant", "Variant", "text"],
  ["unit", "Unit", "text"],
  ["unitPrice", "Unit price", "number"],
];

export default function ProductEditor({ productId }) {
  const router = useRouter();
  const editing = Boolean(productId);
  const [form, setForm] = useState(EMPTY_PRODUCT);
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
    setSaving(true);
    setError("");
    try {
      const product = await apiRequest(
        editing ? `/api/products/${encodeURIComponent(productId)}` : "/api/products",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({ ...form, unitPrice }),
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
          {FIELDS.map(([key, label, type]) => (
            <label key={key}>
              <span>{label} *</span>
              <input
                required
                type={type}
                min={type === "number" ? "0" : undefined}
                step={type === "number" ? "0.01" : undefined}
                value={form[key]}
                onChange={(event) => setField(key, event.target.value)}
              />
            </label>
          ))}
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
        <div className="product-editor__actions">
          <button type="button" disabled={saving} onClick={() => router.push("/products")}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create product"}</button>
        </div>
      </form>
    </main>
  );
}
