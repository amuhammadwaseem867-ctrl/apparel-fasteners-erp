"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Download,
  Filter,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

import "./Stock.css";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "garments", label: "Garments" },
  { value: "fabrics", label: "Fabrics" },
  { value: "accessories", label: "Garment Accessories" },
];

const STOCK_STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "in-stock", label: "In Stock" },
  { value: "low", label: "Low Stock" },
  { value: "out-of-stock", label: "Out of Stock" },
];

export default function StockPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [warehouse, setWarehouse] = useState("all");
  const [loading] = useState(false);

  /*
   * Backend-ready.
   *
   * Do not add mock inventory records here.
   * This array will later be populated by the inventory API.
   */
  const stockItems = [];

  const warehouses = [];

  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      const searchValue = search.trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        item.name?.toLowerCase().includes(searchValue) ||
        item.sku?.toLowerCase().includes(searchValue) ||
        item.productCode?.toLowerCase().includes(searchValue);

      const matchesCategory =
        category === "all" || item.category === category;

      const matchesStatus =
        status === "all" || item.status === status;

      const matchesWarehouse =
        warehouse === "all" || item.warehouseId === warehouse;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesWarehouse
      );
    });
  }, [stockItems, search, category, status, warehouse]);

  const handleReset = () => {
    setSearch("");
    setCategory("all");
    setStatus("all");
    setWarehouse("all");
  };

  const handleExport = () => {
    /*
     * Export API will be connected later.
     */
    /* Backend integration pending. */
  };

  const hasFilters =
    search ||
    category !== "all" ||
    status !== "all" ||
    warehouse !== "all";

  return (
    <main className="inventory-stock">
      <PageHeader
        eyebrow="Inventory"
        title="Stock"
        description="View and monitor available stock across garments, fabrics, and garment accessories."
        action={
          <div className="inventory-stock__header-actions">
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={loading || filteredItems.length === 0}
            >
              <Download size={15} />
              Export
            </Button>

            <Button
              variant="primary"
              onClick={() =>
                router.push("/procurement/goods-receipts")
              }
            >
              <Package size={15} />
              Receive Stock
            </Button>
          </div>
        }
      />

      <div className="inventory-stock__content">
        {/* ------------------------------------------------
            SUMMARY
        ------------------------------------------------ */}

        <section className="inventory-stock__summary">
          <div className="inventory-stock__summary-card">
            <div className="inventory-stock__summary-icon">
              <Boxes size={18} />
            </div>

            <div>
              <span>Total Items</span>
              <strong>{stockItems.length}</strong>
            </div>
          </div>

          <div className="inventory-stock__summary-card">
            <div className="inventory-stock__summary-icon">
              <Warehouse size={18} />
            </div>

            <div>
              <span>Warehouses</span>
              <strong>{warehouses.length}</strong>
            </div>
          </div>

          <div className="inventory-stock__summary-card">
            <div className="inventory-stock__summary-icon">
              <Package size={18} />
            </div>

            <div>
              <span>Low Stock</span>
              <strong>
                {
                  stockItems.filter(
                    (item) => item.status === "low"
                  ).length
                }
              </strong>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------
            FILTER BAR
        ------------------------------------------------ */}

        <section className="inventory-stock__filters">
          <div className="inventory-stock__search">
            <Search size={16} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search SKU, product name..."
              aria-label="Search inventory stock"
            />
          </div>

          <div className="inventory-stock__filter">
            <Filter size={15} />

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              aria-label="Filter by category"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inventory-stock__filter">
            <SlidersHorizontal size={15} />

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter by stock status"
            >
              {STOCK_STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inventory-stock__filter">
            <Warehouse size={15} />

            <select
              value={warehouse}
              onChange={(event) =>
                setWarehouse(event.target.value)
              }
              aria-label="Filter by warehouse"
            >
              <option value="all">All Warehouses</option>

              {warehouses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="inventory-stock__reset"
              onClick={handleReset}
            >
              Reset
            </button>
          )}
        </section>

        {/* ------------------------------------------------
            STOCK TABLE
        ------------------------------------------------ */}

        <section className="inventory-stock__table-card">
          <div className="inventory-stock__table-header">
            <div>
              <span className="inventory-stock__eyebrow">
                Stock Register
              </span>

              <h2>Current Stock</h2>
            </div>

            <div className="inventory-stock__table-meta">
              {filteredItems.length} records
            </div>
          </div>

          {loading ? (
            <div className="inventory-stock__loading">
              <RefreshCw
                size={18}
                className="inventory-stock__loading-icon"
              />

              <span>Loading inventory...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="inventory-stock__empty">
              <div className="inventory-stock__empty-icon">
                <Boxes size={21} />
              </div>

              <h3>No stock records yet</h3>

              <p>
                Inventory stock will appear here once products
                are received and recorded in the system.
              </p>

              <Button
                variant="primary"
                onClick={() =>
                  router.push(
                    "/procurement/goods-receipts"
                  )
                }
              >
                Receive Stock
              </Button>
            </div>
          ) : (
            <div className="inventory-stock__table-wrap">
              <table className="inventory-stock__table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Warehouse</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Unit</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="inventory-stock__product">
                          <strong>{item.name}</strong>

                          {item.variant && (
                            <span>{item.variant}</span>
                          )}
                        </div>
                      </td>

                      <td>{item.sku || "—"}</td>

                      <td>
                        {item.categoryLabel ||
                          item.category ||
                          "—"}
                      </td>

                      <td>
                        {item.warehouseName || "—"}
                      </td>

                      <td>
                        <strong>
                          {item.availableQuantity ?? 0}
                        </strong>
                      </td>

                      <td>
                        {item.reservedQuantity ?? 0}
                      </td>

                      <td>{item.unit || "—"}</td>

                      <td>
                        <span
                          className={`inventory-stock__status inventory-stock__status--${item.status}`}
                        >
                          {item.statusLabel ||
                            item.status ||
                            "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}