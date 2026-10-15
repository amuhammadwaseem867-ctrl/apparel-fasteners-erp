"use client";

import Link from "next/link";
import { useState } from "react";

import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const LABELS = { size: "Size", material: "Material", finish: "Finish", color: "Colour", logoType: "Logo" };

export default function VariantsPage() {
  const [search, setSearch] = useState("");
  const result = useApiData(`/api/products/variants${toQuery({ search })}`);
  const families = result.data?.families ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/products">Products</Link></p>
          <h1>Product variants</h1>
          <p>Each size, material, finish, colour and logo combination is its own item and SKU, so fastener types are never merged. Items with the same category, item type and name are shown together as one family, with the attributes that differ.</p>
        </div>
        <div className="inv-header__actions"><Link className="inv-link-button" href="/products/new">New item</Link></div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar"><div className="inv-field"><label htmlFor="pv-search">Search</label><input id="pv-search" type="search" placeholder="SKU, name, category or type" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
        {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !result.data ? <p className="inv-state" role="status">Loading…</p> : families.length === 0 ? <p className="inv-state">No items match.</p> : families.map((family) => (
          <div key={family.key} style={{ padding: "8px 18px 16px" }}>
            <h3 style={{ margin: "8px 0" }}>{family.name} <small style={{ fontWeight: 400 }}>· {family.category}{family.itemType ? ` · ${family.itemType}` : ""} · {family.variants.length} variant{family.variants.length === 1 ? "" : "s"}</small></h3>
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>SKU</th>{family.attributes.map((attribute) => <th key={attribute}>{LABELS[attribute]}</th>)}<th>Unit</th><th className="inv-num">Price</th><th>Status</th></tr></thead>
                <tbody>
                  {family.variants.map((variant) => (
                    <tr key={variant.id}>
                      <td data-label="SKU"><Link href={`/products/${variant.id}`}>{variant.sku}</Link></td>
                      {family.attributes.map((attribute) => <td key={attribute} data-label={LABELS[attribute]}>{variant[attribute] || "—"}</td>)}
                      <td data-label="Unit">{variant.unit}</td>
                      <td data-label="Price" className="inv-num">{variant.unitPrice}</td>
                      <td data-label="Status">{variant.status === "ACTIVE" ? "Active" : variant.status.toLowerCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
