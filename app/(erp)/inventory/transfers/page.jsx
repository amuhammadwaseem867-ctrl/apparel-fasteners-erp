"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Package,
  Search,
  Truck,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";

import "./Transfers.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "in-transit", label: "In Transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    icon: FileText,
    tone: "neutral",
  },
  pending: {
    label: "Pending",
    icon: Clock3,
    tone: "warning",
  },
  "in-transit": {
    label: "In Transit",
    icon: Truck,
    tone: "info",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    tone: "success",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    tone: "danger",
  },
};

export default function TransfersPage() {
  const toast = useToast();

  /*
   * Backend-ready.
   * Transfer records will come from the API later.
   */
  const [transfers, setTransfers] = useState([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    reference: "",
    itemName: "",
    quantity: "",
    sourceWarehouse: "",
    destinationWarehouse: "",
    unit: "Pcs",
  });
  const [loading] = useState(false);



  const filteredTransfers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return transfers.filter((transfer) => {
      const matchesSearch =
        !searchValue ||
        transfer.reference
          ?.toLowerCase()
          .includes(searchValue) ||
        transfer.sourceWarehouse
          ?.toLowerCase()
          .includes(searchValue) ||
        transfer.destinationWarehouse
          ?.toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        status === "all" || transfer.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [transfers, search, status]);

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };

  const handleExport = () => {
    /* Backend export will call the API when connected. */
    return;
  };

  const handleNewTransfer = () => setTransferOpen(true);

  const handleCreateTransfer = () => {
    if (!transferForm.reference.trim() || !transferForm.itemName.trim() || !transferForm.quantity || !transferForm.sourceWarehouse.trim() || !transferForm.destinationWarehouse.trim()) {
      return;
    }

    const transfer = {
      id: `tr-${Date.now()}`,
      reference: transferForm.reference.trim(),
      sourceWarehouse: transferForm.sourceWarehouse.trim(),
      destinationWarehouse: transferForm.destinationWarehouse.trim(),
      itemName: transferForm.itemName.trim(),
      itemCount: 1,
      quantity: Number(transferForm.quantity),
      unit: transferForm.unit,
      status: "pending",
      requestedBy: "Current User",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setTransfers((current) => [transfer, ...current]);
    setTransferOpen(false);
    setTransferForm({ reference: "", itemName: "", quantity: "", sourceWarehouse: "", destinationWarehouse: "", unit: "Pcs" });
    toast.success({ title: "Transfer created", message: transfer.reference + " is pending." });
  };

  const totalItems = transfers.reduce(
    (sum, transfer) => sum + (transfer.itemCount || 0),
    0
  );

  const inTransit = transfers.filter(
    (transfer) => transfer.status === "in-transit"
  ).length;

  const completed = transfers.filter(
    (transfer) => transfer.status === "completed"
  ).length;

  const pending = transfers.filter(
    (transfer) =>
      transfer.status === "pending" ||
      transfer.status === "draft"
  ).length;

  const hasFilters = search || status !== "all";

  return (
    <main className="inventory-transfers">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Transfers"
        description="Move inventory between warehouses while maintaining a complete transfer history."
        action={
          <div className="inventory-transfers__header-actions">
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={
                loading ||
                filteredTransfers.length === 0
              }
            >
              <Download size={15} />
              Export
            </Button>

            <Button
              variant="primary"
              onClick={handleNewTransfer}
            >
              <ArrowLeftRight size={15} />
              New Transfer
            </Button>
          </div>
        }
      />

      <div className="inventory-transfers__content">
        {/* ------------------------------------------------
            SUMMARY
        ------------------------------------------------ */}

        <section className="inventory-transfers__summary">
          <div className="inventory-transfers__summary-card">
            <div className="inventory-transfers__summary-icon">
              <ArrowLeftRight size={18} />
            </div>

            <div>
              <span>Total Transfers</span>
              <strong>{transfers.length}</strong>
            </div>
          </div>

          <div className="inventory-transfers__summary-card">
            <div className="inventory-transfers__summary-icon">
              <Clock3 size={18} />
            </div>

            <div>
              <span>Pending</span>
              <strong>{pending}</strong>
            </div>
          </div>

          <div className="inventory-transfers__summary-card">
            <div className="inventory-transfers__summary-icon">
              <Truck size={18} />
            </div>

            <div>
              <span>In Transit</span>
              <strong>{inTransit}</strong>
            </div>
          </div>

          <div className="inventory-transfers__summary-card">
            <div className="inventory-transfers__summary-icon">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <span>Completed</span>
              <strong>{completed}</strong>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------
            FILTERS
        ------------------------------------------------ */}

        <section className="inventory-transfers__filters">
          <div className="inventory-transfers__search">
            <Search size={16} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search transfer reference or warehouse..."
              aria-label="Search stock transfers"
            />
          </div>

          <div className="inventory-transfers__select">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter transfer status"
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
              className="inventory-transfers__reset"
              onClick={resetFilters}
            >
              Reset
            </button>
          )}
        </section>

        {/* ------------------------------------------------
            TRANSFER TABLE
        ------------------------------------------------ */}

        <section className="inventory-transfers__card">
          <div className="inventory-transfers__card-header">
            <div>
              <span className="inventory-transfers__eyebrow">
                Transfer Register
              </span>

              <h2>Transfer History</h2>
            </div>

            <span className="inventory-transfers__count">
              {filteredTransfers.length} records
            </span>
          </div>

          {loading ? (
            <div className="inventory-transfers__loading">
              Loading transfers...
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="inventory-transfers__empty">
              <div className="inventory-transfers__empty-icon">
                <ArrowLeftRight size={22} />
              </div>

              <h3>No stock transfers yet</h3>

              <p>
                Warehouse-to-warehouse transfers will appear
                here once inventory is moved between locations.
              </p>

              <Button
                variant="primary"
                onClick={handleNewTransfer}
              >
                <ArrowLeftRight size={15} />
                New Transfer
              </Button>
            </div>
          ) : (
            <div className="inventory-transfers__table-wrap">
              <table className="inventory-transfers__table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Items</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransfers.map((transfer) => {
                    const config =
                      STATUS_CONFIG[transfer.status] ||
                      STATUS_CONFIG.draft;

                    const Icon = config.icon;

                    return (
                      <tr key={transfer.id}>
                        <td>
                          <strong>
                            {transfer.reference || "—"}
                          </strong>
                        </td>

                        <td>
                          <div className="inventory-transfers__warehouse">
                            <Package size={14} />
                            <span>
                              {transfer.sourceWarehouse ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="inventory-transfers__warehouse">
                            <Package size={14} />
                            <span>
                              {transfer.destinationWarehouse ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          {transfer.itemCount ?? 0}
                        </td>

                        <td>
                          <strong>
                            {transfer.quantity ?? 0}
                          </strong>

                          {transfer.unit && (
                            <span className="inventory-transfers__unit">
                              {" "}
                              {transfer.unit}
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`inventory-transfers__status inventory-transfers__status--${config.tone}`}
                          >
                            <Icon size={13} />
                            {transfer.statusLabel ||
                              config.label}
                          </span>
                        </td>

                        <td>
                          {transfer.requestedBy || "—"}
                        </td>

                        <td>
                          {transfer.createdAt || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ------------------------------------------------
            TRANSFER FLOW
        ------------------------------------------------ */}

        <section className="inventory-transfers__flow">
          <div className="inventory-transfers__flow-header">
            <div>
              <span className="inventory-transfers__eyebrow">
                Operational Flow
              </span>

              <h2>Transfer Lifecycle</h2>
            </div>
          </div>

          <div className="inventory-transfers__flow-steps">
            <div className="inventory-transfers__flow-step">
              <span>01</span>
              <strong>Request</strong>
              <small>Create transfer request</small>
            </div>

            <div className="inventory-transfers__flow-line" />

            <div className="inventory-transfers__flow-step">
              <span>02</span>
              <strong>Approve</strong>
              <small>Validate stock availability</small>
            </div>

            <div className="inventory-transfers__flow-line" />

            <div className="inventory-transfers__flow-step">
              <span>03</span>
              <strong>Dispatch</strong>
              <small>Release stock from source</small>
            </div>

            <div className="inventory-transfers__flow-line" />

            <div className="inventory-transfers__flow-step">
              <span>04</span>
              <strong>Receive</strong>
              <small>Confirm destination receipt</small>
            </div>
          </div>
        </section>
      </div>
      {/* NEW TRANSFER MODAL */}

      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="New Stock Transfer"
        description="Move inventory between warehouses."
      >
        <div className="inventory-transfers__form">
          <Input label="Reference *" placeholder="e.g. TR-2026-001" value={transferForm.reference}
            onChange={(event) => setTransferForm((f) => ({ ...f, reference: event.target.value }))}
          />
          <Input label="Item *" placeholder="e.g. Teeth #5 Brass" value={transferForm.itemName}
            onChange={(event) => setTransferForm((f) => ({ ...f, itemName: event.target.value }))}
          />
          <Input label="Quantity *" type="number" min="1" value={transferForm.quantity}
            onChange={(event) => setTransferForm((f) => ({ ...f, quantity: event.target.value }))}
          />
          <Input label="From Warehouse *" value={transferForm.sourceWarehouse}
            onChange={(event) => setTransferForm((f) => ({ ...f, sourceWarehouse: event.target.value }))}
          />
          <Input label="To Warehouse *" value={transferForm.destinationWarehouse}
            onChange={(event) => setTransferForm((f) => ({ ...f, destinationWarehouse: event.target.value }))}
          />
          <div className="inventory-transfers__form-actions">
            <Button variant="secondary" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!transferForm.reference.trim() || !transferForm.itemName.trim() || !transferForm.quantity || !transferForm.sourceWarehouse.trim() || !transferForm.destinationWarehouse.trim()} onClick={handleCreateTransfer}>Create Transfer</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}