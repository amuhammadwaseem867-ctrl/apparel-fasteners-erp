"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import "../ProductMaster.css";

export default function ProductDetailClient({ id }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest(`/api/products/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setProduct(value); })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return (
    <main className="product-master">
      <header className="product-master__header">
        <div>
          <p>PRODUCT MASTER</p>
          <h1>{product?.name || "Product details"}</h1>
          <span>Catalog record loaded from the database.</span>
        </div>
        <div className="product-master__detail-actions">
          <Link href="/products">Products</Link>
          {product && product.status !== "ARCHIVED" && <Link href={`/products/${product.id}/edit`}>Edit product</Link>}
        </div>
      </header>
      <section className="product-master__detail">
        {loading && <p role="status">Loading product…</p>}
        {!loading && error && <p role="alert" className="product-master__error">{error}</p>}
        {!loading && !error && product && (
          <dl>
            <div><dt>SKU</dt><dd>{product.sku}</dd></div>
            <div><dt>Category</dt><dd>{product.category}</dd></div>
            <div><dt>Product type</dt><dd>{product.productType}</dd></div>
            <div><dt>Variant</dt><dd>{product.variant || "—"}</dd></div>
            <div><dt>Unit</dt><dd>{product.unit}</dd></div>
            <div><dt>Unit price</dt><dd>{Number(product.unitPrice).toFixed(2)}</dd></div>
            <div><dt>Status</dt><dd>{product.status}</dd></div>
            <div><dt>Stock</dt><dd>Not configured</dd></div>
            <div className="product-master__detail-wide"><dt>Description</dt><dd>{product.description || "—"}</dd></div>
            <div><dt>Created</dt><dd>{new Date(product.createdAt).toLocaleString()}</dd></div>
            <div><dt>Updated</dt><dd>{new Date(product.updatedAt).toLocaleString()}</dd></div>
          </dl>
        )}
      </section>
    </main>
  );
}
