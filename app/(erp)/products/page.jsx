"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import "./ProductMaster.css";

const PAGE_SIZE = 25;

export default function ProductsPage() {
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    productType: "",
    variant: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      try {
        const data = await apiRequest(`/api/products?${params}`);
        if (active) setResult(data);
      } catch (cause) {
        if (active) setError(cause.message);
      } finally {
        if (active) setLoading(false);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters, page, refresh]);

  function changeFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  async function archive(product) {
    if (!window.confirm(`Archive ${product.name} (${product.sku})? Existing order history will be preserved.`)) return;
    try {
      await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      setRefresh((current) => current + 1);
    } catch (cause) {
      setError(cause.message);
    }
  }

  const products = result?.products ?? [];

  return (
    <main className="product-master">
      <header className="product-master__header">
        <div>
          <p>PRODUCT MASTER</p>
          <h1>Products</h1>
          <span>Catalog records and commercial details. Stock is not configured in this database.</span>
        </div>
        <Link className="product-master__primary" href="/products/new">+ Create product</Link>
      </header>

      <section className="product-master__filters" aria-label="Product filters">
        <label className="product-master__search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Name, SKU, category or variant"
            value={filters.search}
            onChange={(event) => changeFilter("search", event.target.value)}
          />
        </label>
        <label>
          <span>Category</span>
          <input value={filters.category} onChange={(event) => changeFilter("category", event.target.value)} />
        </label>
        <label>
          <span>Type</span>
          <input value={filters.productType} onChange={(event) => changeFilter("productType", event.target.value)} />
        </label>
        <label>
          <span>Variant</span>
          <input value={filters.variant} onChange={(event) => changeFilter("variant", event.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(event) => changeFilter("status", event.target.value)}>
            <option value="">Active and inactive</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </section>

      <section className="product-master__table-panel" aria-label="Product records">
        <div className="product-master__table-scroll">
          <table className="product-master__table">
            <thead>
              <tr>
                <th>SKU</th><th>Product</th><th>Category</th><th>Type</th>
                <th>Variant</th><th>Unit</th><th>Status</th><th>Stock</th>
                <th>Updated</th><th className="product-master__right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="10" className="product-master__message">Loading product records…</td></tr>}
              {!loading && error && (
                <tr><td colSpan="10" className="product-master__message product-master__error">
                  {error} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button>
                </td></tr>
              )}
              {!loading && !error && products.length === 0 && (
                <tr><td colSpan="10" className="product-master__message">No products found.</td></tr>
              )}
              {!loading && !error && products.map((product) => (
                <tr key={product.id}>
                  <td>{product.sku}</td>
                  <td><Link href={`/products/${product.id}`}>{product.name}</Link></td>
                  <td>{product.category}</td>
                  <td>{product.productType}</td>
                  <td>{product.variant || "—"}</td>
                  <td>{product.unit}</td>
                  <td><span className={`product-master__status product-master__status--${product.status.toLowerCase()}`}>{product.status}</span></td>
                  <td>Not configured</td>
                  <td>{new Date(product.updatedAt).toLocaleDateString()}</td>
                  <td className="product-master__actions">
                    <Link href={`/products/${product.id}`}>View</Link>
                    {product.status !== "ARCHIVED" && <Link href={`/products/${product.id}/edit`}>Edit</Link>}
                    {product.status !== "ARCHIVED" && <button type="button" onClick={() => archive(product)}>Archive</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="product-master__pagination">
          <span>Page {page}{result?.hasMore ? "+" : ""}</span>
          <div>
            <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <button type="button" disabled={loading || !result?.hasMore} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </footer>
      </section>
    </main>
  );
}
