"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Download,
  MapPin,
  Package,
  Plus,
  Search,
  Warehouse as WarehouseIcon,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

import "./Warehouses.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "attention", label: "Attention" },
  { value: "inactive", label: "Inactive" },
];

export default function WarehousesPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading] = useState(false);

  /*
   * Backend-ready.
   * Real warehouse records will come from the API later.
   */
  const warehouses = [];

  const filteredWarehouses = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return warehouses.filter((warehouse) => {
      const matchesSearch =
        !searchValue ||
        warehouse.name?.toLowerCase().includes(searchValue) ||
        warehouse.code?.toLowerCase().includes(searchValue) ||
        warehouse.location?.toLowerCase().includes(searchValue);

      const matchesStatus =
        status === "all" || warehouse.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [warehouses, search, status]);

  const totalCapacity = warehouses.reduce(
    (sum, warehouse) => sum + (warehouse.capacity || 0),
    0
  );

  const usedCapacity = warehouses.reduce(
    (sum, warehouse) => sum + (warehouse.usedCapacity || 0),
    0
  );

  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.status === "active"
  ).length;

  const attentionWarehouses = warehouses.filter(
    (warehouse) => warehouse.status === "attention"
  ).length;

  const handleAddWarehouse = () => {
    /*
     * Warehouse creation form/API will be connected later.
     */
    /* Backend integration pending. */
  };

  const handleExport = () => {
    /*
     * Export API will be connected later.
     */
    /* Backend integration pending. */
  };

  const handleReset = () => {
    setSearch("");
    setStatus("all");
  };

  const hasFilters = search || status !== "all";

  return (
    <main className="inventory-warehouses">
      <PageHeader
        eyebrow="Inventory"
        title="Warehouses"
        description="Manage storage facilities, warehouse locations, capacity, and inventory availability."
        action={
          <div className="inventory-warehouses__header-actions">
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={loading || warehouses.length === 0}
            >
              <Download size={15} />
              Export
            </Button>

            <Button
              variant="primary"
              onClick={handleAddWarehouse}
            >
              <Plus size={15} />
              Add Warehouse
            </Button>
          </div>
        }
      />

      <div className="inventory-warehouses__content">
        {/* ------------------------------------------------
            SUMMARY
        ------------------------------------------------ */}

        <section className="inventory-warehouses__summary">
          <div className="inventory-warehouses__summary-card">
            <div className="inventory-warehouses__summary-icon">
              <WarehouseIcon size={18} />
            </div>

            <div>
              <span>Total Warehouses</span>
              <strong>{warehouses.length}</strong>
            </div>
          </div>

          <div className="inventory-warehouses__summary-card">
            <div className="inventory-warehouses__summary-icon">
              <Building2 size={18} />
            </div>

            <div>
              <span>Active</span>
              <strong>{activeWarehouses}</strong>
            </div>
          </div>

          <div className="inventory-warehouses__summary-card">
            <div className="inventory-warehouses__summary-icon">
              <MapPin size={18} />
            </div>

            <div>
              <span>Attention</span>
              <strong>{attentionWarehouses}</strong>
            </div>
          </div>

          <div className="inventory-warehouses__summary-card">
            <div className="inventory-warehouses__summary-icon">
              <Package size={18} />
            </div>

            <div>
              <span>Capacity Used</span>
              <strong>
                {totalCapacity > 0
                  ? `${Math.round(
                      (usedCapacity / totalCapacity) * 100
                    )}%`
                  : "0%"}
              </strong>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------
            FILTERS
        ------------------------------------------------ */}

        <section className="inventory-warehouses__filters">
          <div className="inventory-warehouses__search">
            <Search size={16} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search warehouse, code, location..."
              aria-label="Search warehouses"
            />
          </div>

          <div className="inventory-warehouses__select">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter warehouse status"
            >
              {STATUS_OPTIONS.map((option) => (
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
              className="inventory-warehouses__reset"
              onClick={handleReset}
            >
              Reset
            </button>
          )}
        </section>

        {/* ------------------------------------------------
            WAREHOUSE LIST
        ------------------------------------------------ */}

        <section className="inventory-warehouses__card">
          <div className="inventory-warehouses__card-header">
            <div>
              <span className="inventory-warehouses__eyebrow">
                Warehouse Master
              </span>

              <h2>Storage Locations</h2>
            </div>

            <span className="inventory-warehouses__count">
              {filteredWarehouses.length} records
            </span>
          </div>

          {loading ? (
            <div className="inventory-warehouses__loading">
              Loading warehouses...
            </div>
          ) : filteredWarehouses.length === 0 ? (
            <div className="inventory-warehouses__empty">
              <div className="inventory-warehouses__empty-icon">
                <WarehouseIcon size={22} />
              </div>

              <h3>No warehouses configured</h3>

              <p>
                Warehouse locations will appear here once they
                are created in the system.
              </p>

              <Button
                variant="primary"
                onClick={handleAddWarehouse}
              >
                <Plus size={15} />
                Add Warehouse
              </Button>
            </div>
          ) : (
            <div className="inventory-warehouses__grid">
              {filteredWarehouses.map((warehouse) => {
                const capacity =
                  warehouse.capacity || 0;

                const used =
                  warehouse.usedCapacity || 0;

                const utilization =
                  capacity > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (used / capacity) * 100
                        )
                      )
                    : 0;

                return (
                  <article
                    className="inventory-warehouses__item"
                    key={warehouse.id}
                  >
                    <div className="inventory-warehouses__item-top">
                      <div className="inventory-warehouses__item-icon">
                        <WarehouseIcon size={18} />
                      </div>

                      <span
                        className={`inventory-warehouses__status inventory-warehouses__status--${warehouse.status}`}
                      >
                        {warehouse.statusLabel ||
                          warehouse.status}
                      </span>
                    </div>

                    <h3>{warehouse.name}</h3>

                    <div className="inventory-warehouses__code">
                      {warehouse.code || "—"}
                    </div>

                    <div className="inventory-warehouses__location">
                      <MapPin size={14} />
                      <span>
                        {warehouse.location || "Location not set"}
                      </span>
                    </div>

                    <div className="inventory-warehouses__stats">
                      <div>
                        <span>Items</span>
                        <strong>
                          {warehouse.items || 0}
                        </strong>
                      </div>

                      <div>
                        <span>Quantity</span>
                        <strong>
                          {warehouse.quantity || 0}
                        </strong>
                      </div>
                    </div>

                    <div className="inventory-warehouses__capacity">
                      <div className="inventory-warehouses__capacity-header">
                        <span>Capacity</span>
                        <strong>
                          {utilization}%
                        </strong>
                      </div>

                      <div className="inventory-warehouses__progress">
                        <span
                          style={{
                            width: `${utilization}%`,
                          }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}