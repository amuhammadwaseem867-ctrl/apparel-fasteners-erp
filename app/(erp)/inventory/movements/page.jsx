"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Download,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

import "./Movements.css";

const TYPE_OPTIONS = [
  { value: "all", label: "All Movements" },
  { value: "receipt", label: "Receipt" },
  { value: "issue", label: "Issue" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
];

const DIRECTION_OPTIONS = [
  { value: "all", label: "All Directions" },
  { value: "in", label: "Stock In" },
  { value: "out", label: "Stock Out" },
];

const MOVEMENT_CONFIG = {
  receipt: {
    label: "Receipt",
    icon: ArrowDownToLine,
    tone: "success",
  },
  issue: {
    label: "Issue",
    icon: ArrowUpFromLine,
    tone: "danger",
  },
  transfer: {
    label: "Transfer",
    icon: ArrowLeftRight,
    tone: "info",
  },
  adjustment: {
    label: "Adjustment",
    icon: SlidersHorizontal,
    tone: "warning",
  },
};

export default function MovementsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [direction, setDirection] = useState("all");
  const [loading] = useState(false);

  /*
   * Backend-ready.
   * No mock movement records.
   */
  const movements = [];

  const filteredMovements = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const matchesSearch =
        !searchValue ||
        movement.reference
          ?.toLowerCase()
          .includes(searchValue) ||
        movement.productName
          ?.toLowerCase()
          .includes(searchValue) ||
        movement.sku
          ?.toLowerCase()
          .includes(searchValue) ||
        movement.warehouseName
          ?.toLowerCase()
          .includes(searchValue);

      const matchesType =
        type === "all" || movement.type === type;

      const matchesDirection =
        direction === "all" ||
        movement.direction === direction;

      return (
        matchesSearch &&
        matchesType &&
        matchesDirection
      );
    });
  }, [movements, search, type, direction]);

  const resetFilters = () => {
    setSearch("");
    setType("all");
    setDirection("all");
  };

  const handleExport = () => {
    /*
     * Real client-side CSV export of the currently filtered
     * movements. Backend-generated Excel/PDF exports will
     * replace this when the API is connected.
     */
    const rows = [
      [
        "Type", "Reference", "Product", "SKU", "Warehouse",
        "Direction", "Quantity", "Unit", "User", "Date",
      ],
      ...filteredMovements.map((movement) => [
        movement.typeLabel || movement.type,
        movement.reference || "",
        movement.productName || "",
        movement.sku || "",
        movement.warehouseName || "",
        movement.direction || "",
        movement.quantity ?? "",
        movement.unit || "",
        movement.userName || "",
        movement.createdAt || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"` + String(cell).replace(/"/g, `""`) + `"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stock-movements-" + new Date().toISOString().slice(0, 10) + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    /*
     * API refetch will be connected later; filters reset is the
     * current frontend behavior.
     */
    resetFilters();
  };
  const hasFilters =
    search ||
    type !== "all" ||
    direction !== "all";

  return (
    <main className="inventory-movements">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Movements"
        description="Track every inventory movement across warehouses, products, and stock operations."
        action={
          <div className="inventory-movements__header-actions">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Refresh
            </Button>

            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={
                loading ||
                filteredMovements.length === 0
              }
            >
              <Download size={15} />
              Export
            </Button>
          </div>
        }
      />

      <div className="inventory-movements__content">
        {/* ------------------------------------------------
            SUMMARY
        ------------------------------------------------ */}

        <section className="inventory-movements__summary">
          <div className="inventory-movements__summary-card">
            <span>Total Movements</span>
            <strong>{movements.length}</strong>
          </div>

          <div className="inventory-movements__summary-card">
            <span>Stock In</span>
            <strong>
              {
                movements.filter(
                  (item) => item.direction === "in"
                ).length
              }
            </strong>
          </div>

          <div className="inventory-movements__summary-card">
            <span>Stock Out</span>
            <strong>
              {
                movements.filter(
                  (item) => item.direction === "out"
                ).length
              }
            </strong>
          </div>

          <div className="inventory-movements__summary-card">
            <span>Transfers</span>
            <strong>
              {
                movements.filter(
                  (item) => item.type === "transfer"
                ).length
              }
            </strong>
          </div>
        </section>

        {/* ------------------------------------------------
            FILTERS
        ------------------------------------------------ */}

        <section className="inventory-movements__filters">
          <div className="inventory-movements__search">
            <Search size={16} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search reference, SKU, product..."
              aria-label="Search stock movements"
            />
          </div>

          <div className="inventory-movements__filter">
            <Filter size={15} />

            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value)
              }
              aria-label="Filter movement type"
            >
              {TYPE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inventory-movements__filter">
            <SlidersHorizontal size={15} />

            <select
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value)
              }
              aria-label="Filter movement direction"
            >
              {DIRECTION_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="inventory-movements__reset"
              onClick={resetFilters}
            >
              Reset
            </button>
          )}
        </section>

        {/* ------------------------------------------------
            MOVEMENT TABLE
        ------------------------------------------------ */}

        <section className="inventory-movements__card">
          <div className="inventory-movements__card-header">
            <div>
              <span className="inventory-movements__eyebrow">
                Stock Ledger
              </span>

              <h2>Movement History</h2>
            </div>

            <span className="inventory-movements__count">
              {filteredMovements.length} records
            </span>
          </div>

          {loading ? (
            <div className="inventory-movements__loading">
              <RefreshCw
                size={17}
                className="inventory-movements__spin"
              />
              Loading movements...
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="inventory-movements__empty">
              <div className="inventory-movements__empty-icon">
                <ArrowLeftRight size={21} />
              </div>

              <h3>No stock movements yet</h3>

              <p>
                Stock receipts, issues, transfers, and
                adjustments will appear here once inventory
                operations are recorded.
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
            <div className="inventory-movements__table-wrap">
              <table className="inventory-movements__table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Product</th>
                    <th>Warehouse</th>
                    <th>Direction</th>
                    <th>Quantity</th>
                    <th>User</th>
                    <th>Date / Time</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMovements.map((movement) => {
                    const config =
                      MOVEMENT_CONFIG[movement.type] ||
                      MOVEMENT_CONFIG.adjustment;

                    const Icon = config.icon;

                    return (
                      <tr key={movement.id}>
                        <td>
                          <div className="inventory-movements__type">
                            <span
                              className={`inventory-movements__type-icon inventory-movements__type-icon--${config.tone}`}
                            >
                              <Icon size={15} />
                            </span>

                            <span>
                              {movement.typeLabel ||
                                config.label}
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {movement.reference || "—"}
                          </strong>
                        </td>

                        <td>
                          <div className="inventory-movements__product">
                            <strong>
                              {movement.productName || "—"}
                            </strong>

                            {movement.sku && (
                              <span>
                                {movement.sku}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          {movement.warehouseName || "—"}
                        </td>

                        <td>
                          <span
                            className={`inventory-movements__direction inventory-movements__direction--${movement.direction}`}
                          >
                            {movement.direction === "in"
                              ? "Stock In"
                              : movement.direction ===
                                "out"
                              ? "Stock Out"
                              : "—"}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {movement.quantity ?? 0}
                          </strong>

                          {movement.unit && (
                            <span className="inventory-movements__unit">
                              {" "}
                              {movement.unit}
                            </span>
                          )}
                        </td>

                        <td>
                          {movement.userName || "—"}
                        </td>

                        <td>
                          {movement.createdAt || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}