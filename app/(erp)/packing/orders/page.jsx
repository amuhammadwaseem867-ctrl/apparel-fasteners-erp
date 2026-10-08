"use client";

import { useMemo, useState } from "react";
import { Package, Plus } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

import useFulfillmentStore from "@/lib/useFulfillmentStore";

import { UNITS } from "@/config/items";

import "../PackingPages.css";

/*
 * Packing Orders — QC-approved quantities released for packing.
 * Real workflow: create → pack → complete → mark ready
 * (order then appears in Dispatch → Ready for Delivery).
 */

const PACKAGE_TYPES = [
  "Carton",
  "Box",
  "Poly Bag",
  "Bundle",
  "Pallet",
  "Other",
];

const EMPTY_FORM = {
  orderId: "",
  product: "",
  approvedQuantity: "",
  packageType: "Carton",
  packageCount: "",
  weight: "",
  dimensions: "",
  instructions: "",
  specialInstructions: "",
  unit: "Pcs",
};

export default function PackingOrdersPage() {
  const toast = useToast();

  const {
    packingOrders,
    createPackingOrder,
    pack,
    markReady,
  } = useFulfillmentStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [packTarget, setPackTarget] = useState(null);
  const [packQty, setPackQty] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return packingOrders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;

      if (search.trim()) {
        const value = search.trim().toLowerCase();

        const searchable = [order.orderId, order.product]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(value)) return false;
      }

      return true;
    });
  }, [packingOrders, search, statusFilter]);

  function handleCreate() {
    setSubmitting(true);

    const record = createPackingOrder(form);

    setSubmitting(false);
    setCreateOpen(false);
    setForm(EMPTY_FORM);

    toast.success({
      title: "Packing order created",
      message: `${record.orderId} is open for packing.`,
    });
  }

  function handlePack() {
    if (!packTarget || !packQty) return;

    const qty = Number(packQty);
    const remaining = packTarget.approvedQuantity - packTarget.packedQuantity;

    if (qty <= 0 || qty > remaining) {
      toast.error({
        title: "Invalid quantity",
        message: `Packed quantity cannot exceed the remaining ${remaining} ${packTarget.unit}.`,
      });

      return;
    }

    pack(packTarget.id, qty);
    setPackTarget(null);
    setPackQty("");

    toast.success({ title: "Quantity packed" });
  }

  function handleMarkReady(order) {
    markReady(order.id);

    toast.success({
      title: "Ready for delivery",
      message: `${order.orderId} handed off to dispatch.`,
    });
  }

  const statusVariant = {
    open: "info",
    "in-progress": "warning",
    completed: "success",
    ready: "success",
  };

  const statusLabel = {
    open: "Open",
    "in-progress": "Packing",
    completed: "Packed",
    ready: "Ready for Delivery",
  };

  return (
    <main className="packing-pages">
      <PageHeader
        eyebrow="Factory Operations / Packing"
        title="Packing Orders"
        description="QC-approved quantities released for packing. Pack quantities, complete the order and mark it ready for delivery."
        action={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setCreateOpen(true)}
          >
            New Packing Order
          </Button>
        }
      />

      <div className="packing-pages__content">
        <section className="packing-pages__toolbar">
          <div className="packing-pages__search">
            <Input
              placeholder="Search by order number, product..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "open", label: "Open" },
              { value: "in-progress", label: "Packing" },
              { value: "completed", label: "Packed" },
              { value: "ready", label: "Ready for Delivery" },
            ]}
            fullWidth={false}
          />
        </section>

        <section className="packing-pages__list-card">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                packingOrders.length === 0
                  ? "No packing orders"
                  : "No matching packing orders"
              }
              description={
                packingOrders.length === 0
                  ? "Create a packing order for a QC-approved quantity to start packing."
                  : "No packing orders match the current filters."
              }
              action={
                packingOrders.length === 0 ? (
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setCreateOpen(true)}
                  >
                    New Packing Order
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                )
              }
            />
          ) : (
            <div className="packing-pages__table-wrap">
              <table className="packing-pages__table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Approved</th>
                    <th>Packed</th>
                    <th>Remaining</th>
                    <th>Package</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((order) => {
                    const remaining =
                      order.approvedQuantity - order.packedQuantity;

                    return (
                      <tr key={order.id}>
                        <td>{order.orderId}</td>

                        <td>{order.product}</td>

                        <td>
                          {order.approvedQuantity.toLocaleString()}{" "}
                          {order.unit}
                        </td>

                        <td>{order.packedQuantity.toLocaleString()}</td>

                        <td>{remaining.toLocaleString()}</td>

                        <td>
                          {order.packageType}
                          {order.packageCount
                            ? ` × ${order.packageCount}`
                            : ""}
                        </td>

                        <td>
                          <Badge variant={statusVariant[order.status]}>
                            {statusLabel[order.status]}
                          </Badge>
                        </td>

                        <td>
                          <div className="packing-pages__row-actions">
                            {remaining > 0 && order.status !== "ready" && (
                              <Button
                                variant="primary"
                                size="small"
                                onClick={() => {
                                  setPackTarget(order);
                                  setPackQty("");
                                }}
                              >
                                Pack
                              </Button>
                            )}

                            {order.status === "completed" && (
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() => handleMarkReady(order)}
                              >
                                Mark Ready
                              </Button>
                            )}
                          </div>
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

      {/* CREATE */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Packing Order"
        description="Release a QC-approved quantity for packing."
      >
        <div className="packing-pages__form">
          <Input
            label="Order Number / Reference *"
            placeholder="e.g. order number"
            value={form.orderId}
            onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}
          />

          <Input
            label="Product *"
            placeholder="e.g. Metal Zipper #5 — Antique Silver"
            value={form.product}
            onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
          />

          <Input
            label="Approved Quantity *"
            type="number"
            min="1"
            value={form.approvedQuantity}
            onChange={(e) =>
              setForm((f) => ({ ...f, approvedQuantity: e.target.value }))
            }
          />

          <Select
            label="Unit"
            value={form.unit}
            onChange={(value) => setForm((f) => ({ ...f, unit: value }))}
            options={UNITS.map((unit) => ({ value: unit, label: unit }))}
          />

          <Select
            label="Package Type"
            value={form.packageType}
            onChange={(value) => setForm((f) => ({ ...f, packageType: value }))}
            options={PACKAGE_TYPES.map((type) => ({ value: type, label: type }))}
          />

          <Input
            label="Package Count"
            type="number"
            min="0"
            value={form.packageCount}
            onChange={(e) =>
              setForm((f) => ({ ...f, packageCount: e.target.value }))
            }
          />

          <Input
            label="Weight (kg)"
            type="number"
            min="0"
            step="0.1"
            value={form.weight}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
          />

          <Input
            label="Dimensions"
            placeholder="e.g. 60 × 40 × 40 cm"
            value={form.dimensions}
            onChange={(e) =>
              setForm((f) => ({ ...f, dimensions: e.target.value }))
            }
          />

          <Input
            label="Packing Instructions"
            value={form.instructions}
            onChange={(e) =>
              setForm((f) => ({ ...f, instructions: e.target.value }))
            }
          />

          <Input
            label="Special Instructions"
            value={form.specialInstructions}
            onChange={(e) =>
              setForm((f) => ({ ...f, specialInstructions: e.target.value }))
            }
          />

          <div className="packing-pages__form-actions">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={
                !form.orderId.trim() ||
                !form.product.trim() ||
                !form.approvedQuantity ||
                submitting
              }
              onClick={handleCreate}
            >
              Create Packing Order
            </Button>
          </div>
        </div>
      </Modal>

      {/* PACK */}
      <Modal
        open={Boolean(packTarget)}
        onClose={() => setPackTarget(null)}
        title="Pack Quantity"
        description={packTarget?.orderId}
      >
        <div className="packing-pages__form">
          <Input
            label={`Quantity to Pack (remaining: ${packTarget
                ? (
                  packTarget.approvedQuantity - packTarget.packedQuantity
                ).toLocaleString()
                : 0
              } ${packTarget?.unit || ""})`}
            type="number"
            min="1"
            value={packQty}
            onChange={(e) => setPackQty(e.target.value)}
          />

          <div className="packing-pages__form-actions">
            <Button variant="secondary" onClick={() => setPackTarget(null)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!packQty || Number(packQty) <= 0}
              onClick={handlePack}
            >
              Pack
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
