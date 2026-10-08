"use client";

import { useState } from "react";
import { PackageCheck, Truck } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

import useFulfillmentStore from "@/lib/useFulfillmentStore";

import "../DispatchPages.css";

export default function ReadyForDeliveryPage() {
  const toast = useToast();

  const { readyOrders, dispatch } = useFulfillmentStore();

  const [dispatchTarget, setDispatchTarget] = useState(null);
  const [form, setForm] = useState({
    carrier: "",
    trackingNumber: "",
    expectedDelivery: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function handleDispatch() {
    if (!dispatchTarget || !form.carrier.trim()) return;

    setSubmitting(true);

    const shipment = dispatch(dispatchTarget.id, form);

    setSubmitting(false);
    setDispatchTarget(null);
    setForm({ carrier: "", trackingNumber: "", expectedDelivery: "", address: "" });

    toast.success({
      title: "Dispatched",
      message: `${shipment.code} created. Track it in Shipments.`,
    });
  }

  return (
    <main className="dispatch-pages">
      <PageHeader
        eyebrow="Factory Operations / Dispatch & Logistics"
        title="Ready for Delivery"
        description="Orders with completed packing, awaiting dispatch. Dispatching creates a shipment."
      />

      <div className="dispatch-pages__content">
        <section className="dispatch-pages__list-card">
          {readyOrders.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="Nothing ready for delivery"
              description="Orders appear here when packing is marked complete. Complete and mark a packing order ready from Packing → Packing Orders."
            />
          ) : (
            <div className="dispatch-pages__table-wrap">
              <table className="dispatch-pages__table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Packed</th>
                    <th>Package</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {readyOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.orderId}</td>

                      <td>{order.product}</td>

                      <td>
                        {order.packedQuantity.toLocaleString()} {order.unit}
                      </td>

                      <td>
                        {order.packageType}
                        {order.packageCount ? ` × ${order.packageCount}` : ""}
                      </td>

                      <td>
                        <Button
                          variant="primary"
                          size="small"
                          icon={Truck}
                          onClick={() => setDispatchTarget(order)}
                        >
                          Dispatch
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(dispatchTarget)}
        onClose={() => setDispatchTarget(null)}
        title="Dispatch Order"
        description={dispatchTarget?.orderId}
      >
        <div className="dispatch-pages__form">
          <Input
            label="Carrier *"
            placeholder="e.g. DHL, TCS, self-pickup"
            value={form.carrier}
            onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
          />

          <Input
            label="Tracking Number"
            value={form.trackingNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, trackingNumber: e.target.value }))
            }
          />

          <Input
            label="Expected Delivery"
            type="date"
            value={form.expectedDelivery}
            onChange={(e) =>
              setForm((f) => ({ ...f, expectedDelivery: e.target.value }))
            }
          />

          <Input
            label="Delivery Address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />

          <div className="dispatch-pages__form-actions">
            <Button variant="secondary" onClick={() => setDispatchTarget(null)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!form.carrier.trim() || submitting}
              onClick={handleDispatch}
            >
              Dispatch
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
