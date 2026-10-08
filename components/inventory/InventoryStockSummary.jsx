"use client";

import {
  Shirt,
  Layers3,
  Package,
  ArrowUpRight,
} from "lucide-react";

import "./InventoryStockSummary.css";

const DEFAULT_CATEGORIES = [
  {
    key: "garments",
    label: "Garments",
    description: "Jackets, sweaters, denim and other garments",
    icon: Shirt,
  },
  {
    key: "fabrics",
    label: "Fabrics",
    description: "Woven, knit, sustainable and technical fabrics",
    icon: Layers3,
  },
  {
    key: "accessories",
    label: "Garment Accessories",
    description: "Zippers, buttons, trims and other accessories",
    icon: Package,
  },
];

export default function InventoryStockSummary({
  data = {},
  loading = false,
  onViewStock,
  categories = DEFAULT_CATEGORIES,
}) {
  const hasStockData = Object.keys(data).length > 0;

  return (
    <section className="inventory-stock-summary">
      <div className="inventory-stock-summary__header">
        <div>
          <span className="inventory-stock-summary__eyebrow">
            Inventory
          </span>

          <h2 className="inventory-stock-summary__title">
            Stock Summary
          </h2>

          <p className="inventory-stock-summary__description">
            Inventory distribution across your core business categories.
          </p>
        </div>

        <button
          type="button"
          className="inventory-stock-summary__view-button"
          onClick={onViewStock}
          disabled={!onViewStock}
        >
          View Stock
          <ArrowUpRight size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="inventory-stock-summary__body">
        {loading ? (
          <StockSummarySkeleton />
        ) : (
          <div className="inventory-stock-summary__categories">
            {categories.map((category) => {
              const Icon = category.icon;
              const categoryData = data[category.key] || {};

              const quantity = categoryData.quantity ?? 0;
              const items = categoryData.items ?? 0;

              return (
                <article
                  key={category.key}
                  className="inventory-stock-category"
                >
                  <div className="inventory-stock-category__top">
                    <div className="inventory-stock-category__icon">
                      <Icon size={19} strokeWidth={1.8} />
                    </div>

                    <div className="inventory-stock-category__heading">
                      <h3>{category.label}</h3>
                      <p>{category.description}</p>
                    </div>
                  </div>

                  <div className="inventory-stock-category__metrics">
                    <div className="inventory-stock-category__metric">
                      <span className="inventory-stock-category__metric-label">
                        Quantity
                      </span>

                      <strong>
                        {hasStockData ? quantity : "0"}
                      </strong>
                    </div>

                    <div className="inventory-stock-category__metric">
                      <span className="inventory-stock-category__metric-label">
                        Items
                      </span>

                      <strong>
                        {hasStockData ? items : "0"}
                      </strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !hasStockData && (
          <div className="inventory-stock-summary__empty">
            <div className="inventory-stock-summary__empty-icon">
              <Package size={18} strokeWidth={1.7} />
            </div>

            <div>
              <strong>No inventory data yet</strong>
              <p>
                Stock information will appear here once inventory
                records are connected.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StockSummarySkeleton() {
  return (
    <div className="inventory-stock-summary__skeleton-grid">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="inventory-stock-summary__skeleton-card"
        >
          <span className="inventory-stock-summary__skeleton-icon" />

          <div className="inventory-stock-summary__skeleton-content">
            <span className="inventory-stock-summary__skeleton-line inventory-stock-summary__skeleton-line--title" />
            <span className="inventory-stock-summary__skeleton-line" />
          </div>

          <span className="inventory-stock-summary__skeleton-value" />
        </div>
      ))}
    </div>
  );
}