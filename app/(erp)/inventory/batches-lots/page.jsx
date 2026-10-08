"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Download,
  Package,
  Search,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

import "./BatchesLots.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "quarantine", label: "Quarantine" },
  { value: "expired", label: "Expired" },
  { value: "depleted", label: "Depleted" },
];

const STATUS_CONFIG = {
  active: {
    label: "Active",
    icon: CheckCircle2,
    tone: "success",
  },
  quarantine: {
    label: "Quarantine",
    icon: ShieldCheck,
    tone: "warning",
  },
  expired: {
    label: "Expired",
    icon: TriangleAlert,
    tone: "danger",
  },
  depleted: {
    label: "Depleted",
    icon: XCircle,
    tone: "neutral",
  },
};

export default function BatchesLotsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading] = useState(false);

  /*
   * Backend-ready.
   * Batch and lot records will come from the API later.
   */
  const batches = [];

  const filteredBatches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return batches.filter((batch) => {
      const matchesSearch =
        !query ||
        batch.batchNumber?.toLowerCase().includes(query) ||
        batch.lotNumber?.toLowerCase().includes(query) ||
        batch.product?.toLowerCase().includes(query) ||
        batch.sku?.toLowerCase().includes(query) ||
        batch.warehouse?.toLowerCase().includes(query);

      const matchesStatus =
        status === "all" || batch.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [batches, search, status]);

  const activeCount = batches.filter(
    (batch) => batch.status === "active"
  ).length;

  const quarantineCount = batches.filter(
    (batch) => batch.status === "quarantine"
  ).length;

  const expiredCount = batches.filter(
    (batch) => batch.status === "expired"
  ).length;

  const totalQuantity = batches.reduce(
    (sum, batch) => sum + (batch.quantity || 0),
    0
  );

  const hasFilters = search || status !== "all";

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const handleExport = () => {
    /* Backend integration pending. */
  };

  const handleAddBatch = () => {
    /* Backend integration pending. */
  };

  return (
    <main className="inventory-batches">
      <PageHeader
        eyebrow="Inventory"
        title="Batches & Lots"
        description="Track inventory batches and lots across warehouses with complete traceability and stock status."
        action={
          <div className="inventory-batches__header-actions">
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={
                loading ||
                filteredBatches.length === 0
              }
            >
              <Download size={15} />
              Export
            </Button>

            <Button
              variant="primary"
              onClick={handleAddBatch}
            >
              <Package size={15} />
              Add Batch
            </Button>
          </div>
        }
      />

      <div className="inventory-batches__content">
        {/* SUMMARY */}

        <section className="inventory-batches__summary">
          <div className="inventory-batches__summary-card">
            <div className="inventory-batches__summary-icon">
              <Archive size={18} />
            </div>

            <div>
              <span>Total Batches</span>
              <strong>{batches.length}</strong>
            </div>
          </div>

          <div className="inventory-batches__summary-card">
            <div className="inventory-batches__summary-icon inventory-batches__summary-icon--success">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <span>Active</span>
              <strong>{activeCount}</strong>
            </div>
          </div>

          <div className="inventory-batches__summary-card">
            <div className="inventory-batches__summary-icon inventory-batches__summary-icon--warning">
              <ShieldCheck size={18} />
            </div>

            <div>
              <span>Quarantine</span>
              <strong>{quarantineCount}</strong>
            </div>
          </div>

          <div className="inventory-batches__summary-card">
            <div className="inventory-batches__summary-icon inventory-batches__summary-icon--danger">
              <TriangleAlert size={18} />
            </div>

            <div>
              <span>Expired</span>
              <strong>{expiredCount}</strong>
            </div>
          </div>

          <div className="inventory-batches__summary-card">
            <div className="inventory-batches__summary-icon">
              <Package size={18} />
            </div>

            <div>
              <span>Total Quantity</span>
              <strong>{totalQuantity}</strong>
            </div>
          </div>
        </section>

        {/* FILTERS */}

        <section className="inventory-batches__filters">
          <div className="inventory-batches__search">
            <Search size={16} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search batch, lot, product, SKU or warehouse..."
              aria-label="Search batches and lots"
            />
          </div>

          <div className="inventory-batches__select">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter batch status"
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
              className="inventory-batches__reset"
              onClick={resetFilters}
            >
              Reset
            </button>
          )}
        </section>

        {/* TABLE */}

        <section className="inventory-batches__card">
          <div className="inventory-batches__card-header">
            <div>
              <span className="inventory-batches__eyebrow">
                Traceability Register
              </span>

              <h2>Batch & Lot Inventory</h2>
            </div>

            <span className="inventory-batches__count">
              {filteredBatches.length} records
            </span>
          </div>

          {loading ? (
            <div className="inventory-batches__loading">
              Loading batches...
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="inventory-batches__empty">
              <div className="inventory-batches__empty-icon">
                <Archive size={22} />
              </div>

              <h3>No batches or lots yet</h3>

              <p>
                Batch and lot records will appear here once
                inventory is received and assigned a traceable
                batch or lot number.
              </p>

              <Button
                variant="primary"
                onClick={handleAddBatch}
              >
                <Package size={15} />
                Add Batch
              </Button>
            </div>
          ) : (
            <div className="inventory-batches__table-wrap">
              <table className="inventory-batches__table">
                <thead>
                  <tr>
                    <th>Batch / Lot</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Warehouse</th>
                    <th>Quantity</th>
                    <th>Manufactured</th>
                    <th>Expiry</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBatches.map((batch) => {
                    const config =
                      STATUS_CONFIG[batch.status] ||
                      STATUS_CONFIG.active;

                    const Icon = config.icon;

                    return (
                      <tr key={batch.id}>
                        <td>
                          <div className="inventory-batches__batch">
                            <strong>
                              {batch.batchNumber || "—"}
                            </strong>

                            {batch.lotNumber && (
                              <span>
                                Lot {batch.lotNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          {batch.product || "—"}
                        </td>

                        <td>
                          <span className="inventory-batches__sku">
                            {batch.sku || "—"}
                          </span>
                        </td>

                        <td>
                          {batch.warehouse || "—"}
                        </td>

                        <td>
                          <strong>
                            {batch.quantity ?? 0}
                          </strong>

                          {batch.unit && (
                            <span className="inventory-batches__unit">
                              {" "}
                              {batch.unit}
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="inventory-batches__date">
                            <CalendarDays size={13} />
                            {batch.manufacturedAt || "—"}
                          </div>
                        </td>

                        <td>
                          <div className="inventory-batches__date">
                            <CalendarDays size={13} />
                            {batch.expiryAt || "—"}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`inventory-batches__status inventory-batches__status--${config.tone}`}
                          >
                            <Icon size={13} />
                            {config.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* TRACEABILITY */}

        <section className="inventory-batches__traceability">
          <div className="inventory-batches__traceability-header">
            <div>
              <span className="inventory-batches__eyebrow">
                Traceability
              </span>

              <h2>Batch Lifecycle</h2>
            </div>
          </div>

          <div className="inventory-batches__traceability-grid">
            <div className="inventory-batches__trace-step">
              <span>01</span>

              <div>
                <strong>Receive</strong>
                <p>
                  Assign the incoming material to a batch
                  or supplier lot.
                </p>
              </div>
            </div>

            <div className="inventory-batches__trace-step">
              <span>02</span>

              <div>
                <strong>Store</strong>
                <p>
                  Track the batch against its warehouse
                  location and stock quantity.
                </p>
              </div>
            </div>

            <div className="inventory-batches__trace-step">
              <span>03</span>

              <div>
                <strong>Move</strong>
                <p>
                  Preserve batch identity during warehouse
                  transfers and issues.
                </p>
              </div>
            </div>

            <div className="inventory-batches__trace-step">
              <span>04</span>

              <div>
                <strong>Consume</strong>
                <p>
                  Link material usage to production,
                  dispatch or other stock transactions.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}