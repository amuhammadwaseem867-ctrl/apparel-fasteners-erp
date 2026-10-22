"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { apiRequest } from "@/lib/api/client";
import { CATEGORY_LABELS, buildCatalog, matchesCatalogEntry } from "@/lib/inventory/catalog";

import "@/components/inventory/InventoryWorkspace.css";

const CATALOG = buildCatalog();

function stockBadge(stock) {
  if (!stock) return <span className="inv-badge">No stock</span>;
  if (stock.outOfStock) return <span className="inv-badge inv-badge--danger">Out of stock</span>;
  if (stock.lowStock) return <span className="inv-badge inv-badge--warning">Low</span>;
  return <span className="inv-badge inv-badge--good">OK</span>;
}

/* Loads every item (all pages) for catalogue coverage; bounded. */
function useAllItems() {
  const [state, setState] = useState({ items: null, error: "" });

  useEffect(() => {
    let active = true;

    (async () => {
      const items = [];
      for (let page = 1; page <= 50; page += 1) {
        const result = await apiRequest(`/api/products?page=${page}&pageSize=100`);
        items.push(...result.products);
        if (!result.hasMore) break;
      }
      return items;
    })()
      .then((items) => { if (active) setState({ items, error: "" }); })
      .catch((cause) => { if (active) setState({ items: null, error: cause.message }); });

    return () => { active = false; };
  }, []);

  return state;
}

function CatalogCoverage() {
  const { items, error } = useAllItems();
  const [category, setCategory] = useState("");

  const rows = useMemo(() => CATALOG
    .filter((entry) => !category || entry.category === category)
    .map((entry) => ({ entry, item: items?.find((product) => matchesCatalogEntry(product, entry)) })),
  [items, category]);

  const missing = rows.filter((row) => !row.item).length;

  function createHref(entry) {
    return `/products/new${toQuery({
      sku: entry.sku,
      name: entry.name,
      category: CATEGORY_LABELS[entry.category] ?? entry.category,
      productType: "Raw Material",
      variant: entry.variant,
      unit: "Pcs",
      size: entry.size,
      material: entry.material,
      itemType: entry.type,
      finish: entry.finish,
      logoType: entry.logo,
    })}`;
  }

  return (
    <section className="inv-card">
      <div className="inv-card__header">
        <div>
          <h2>Required fastener catalogue</h2>
          <small>
            Every distinct specification from the owner&apos;s requirements. Items marked missing do not exist in the item master yet.
            Creating one opens the item form prefilled; no stock is created.
          </small>
        </div>
        {items && <span className="inv-badge">{rows.length - missing} of {rows.length} created</span>}
      </div>
      <div className="inv-toolbar">
        <div className="inv-field">
          <label htmlFor="cat-filter">Category</label>
          <select id="cat-filter" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {[...new Set(CATALOG.map((entry) => entry.category))].map((key) => (
              <option key={key} value={key}>{CATEGORY_LABELS[key] ?? key}</option>
            ))}
          </select>
        </div>
      </div>
      {error ? (
        <p className="inv-state inv-state--error" role="alert">{error}</p>
      ) : !items ? (
        <p className="inv-state" role="status">Checking the item masterâ€¦</p>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr><th>Specification</th><th>Size</th><th>Type</th><th>Finish</th><th>Variant / logo</th><th>Item</th></tr>
            </thead>
            <tbody>
              {rows.map(({ entry, item }) => (
                <tr key={entry.sku}>
                  <td data-label="Specification">{entry.name}<small>{CATEGORY_LABELS[entry.category]}</small></td>
                  <td data-label="Size">{entry.size || "â€”"}</td>
                  <td data-label="Type">{[entry.type, entry.material].filter(Boolean).join(" · ") || "â€”"}</td>
                  <td data-label="Finish">{entry.finish || "â€”"}</td>
                  <td data-label="Variant / logo">{[entry.variant, entry.logo].filter(Boolean).join(" · ") || "â€”"}</td>
                  <td data-label="Item">
                    {item ? (
                      <Link href={`/inventory/item-master/${item.id}`}>{item.sku}</Link>
                    ) : (
                      <Link href={createHref(entry)}>Create item</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ItemList() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const products = useApiData(`/api/products${toQuery({ search, status, category, page, pageSize: 25 })}`);
  const categories = useApiData("/api/products/categories");
  const categoryList = (categories.data?.categories ?? []).filter((entry) => entry.products > 0);
  const summary = useApiData("/api/inventory/summary?include=items");
  const stockById = useMemo(
    () => new Map((summary.data?.items ?? []).map((item) => [item.productId, item])),
    [summary.data],
  );
  const rows = products.data?.products ?? [];

  async function setArchived(item, archived) {
    if (busy) return;
    if (archived && !window.confirm(`Archive ${item.sku}? It stays in history and can be restored.`)) return;
    setBusy(item.id);
    setError("");
    try {
      await apiRequest(`/api/products/${item.id}`, archived
        ? { method: "DELETE" }
        : { method: "PATCH", body: JSON.stringify({ action: "restore" }) });
      products.reload();
      summary.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="inv-card">
      <div className="inv-chips" role="tablist" aria-label="Category">
        {[{ name: "", products: null }, ...categoryList].map((entry) => (
          <button key={entry.name || "all"} type="button" role="tab" aria-selected={category === entry.name}
            className={`inv-chip${category === entry.name ? " is-active" : ""}`}
            onClick={() => { setCategory(entry.name); setPage(1); }}>
            {entry.name || "All"}{entry.products !== null && <small>{entry.products}</small>}
          </button>
        ))}
      </div>
      <div className="inv-toolbar">
        <div className="inv-field">
          <label htmlFor="im-search">Search</label>
          <input id="im-search" type="search" value={search} placeholder="SKU, name, category or variant" onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <div className="inv-field">
          <label htmlFor="im-status">Status</label>
          <select id="im-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Active and inactive</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>
      {error && <p className="inv-state inv-state--error" role="alert">{error}</p>}
      {products.error ? (
        <p className="inv-state inv-state--error" role="alert">{products.error}</p>
      ) : products.loading && !products.data ? (
        <p className="inv-state" role="status">Loading itemsâ€¦</p>
      ) : rows.length === 0 ? (
        <p className="inv-state">{search || status || category ? "No items match these filters." : "No items yet. Create one, or start from the required catalogue."}</p>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>SKU</th><th>Item</th><th>Specification</th><th>Unit</th>
                <th className="inv-num">Min.</th><th className="inv-num">Available</th><th>Stock</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const stock = stockById.get(item.id);
                return (
                  <tr key={item.id}>
                    <td data-label="SKU"><Link href={`/inventory/item-master/${item.id}`}>{item.sku}</Link></td>
                    <td data-label="Item">{item.name}<small>{item.category}</small></td>
                    <td data-label="Specification">
                      {[item.size, item.material, item.itemType, item.finish, item.color, item.variant, item.logoType].filter(Boolean).join(" · ") || "â€”"}
                    </td>
                    <td data-label="Unit">{item.unit}</td>
                    <td data-label="Min." className="inv-num">{item.minimumStock}</td>
                    <td data-label="Available" className="inv-num">{stock?.tracked ? stock.available : "â€”"}</td>
                    <td data-label="Stock">{stockBadge(stock?.tracked ? stock : null)}</td>
                    <td data-label="Status"><span className="inv-badge">{item.status}</span></td>
                    <td data-label="Actions">
                      {item.status === "ARCHIVED" ? (
                        <button type="button" className="inv-text-button" disabled={busy === item.id} onClick={() => setArchived(item, false)}>Restore</button>
                      ) : (
                        <>
                          <Link href={`/products/${item.id}/edit`}>Edit</Link>{" "}
                          <button type="button" className="inv-text-button" disabled={busy === item.id} onClick={() => setArchived(item, true)}>Archive</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <InventoryPager page={page} hasMore={products.data?.hasMore} onChange={setPage} disabled={products.loading} />
    </section>
  );
}

export default function ItemMasterPage() {
  const [tab, setTab] = useState("items");

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Inventory</p>
          <h1>Item Master</h1>
          <p>Every distinct size, material, type, finish, colour, variant and Logo/Plain combination is its own item and SKU, with its own stock and history.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/products/new">New item</Link>
        </div>
      </header>

      <div className="inv-header__actions" role="tablist" aria-label="Item master views">
        <Button variant={tab === "items" ? "primary" : "secondary"} role="tab" aria-selected={tab === "items"} onClick={() => setTab("items")}>
          Items
        </Button>
        <Button variant={tab === "catalog" ? "primary" : "secondary"} role="tab" aria-selected={tab === "catalog"} onClick={() => setTab("catalog")}>
          Catalogue coverage
        </Button>
      </div>

      {tab === "items" ? <ItemList /> : <CatalogCoverage />}
    </main>
  );
}

