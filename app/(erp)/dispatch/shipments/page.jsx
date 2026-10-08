"use client";

import { CheckCircle2, Truck } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

import useFulfillmentStore from "@/lib/useFulfillmentStore";

import "../DispatchPages.css";

export default function ShipmentsPage() {
  const toast = useToast();

  const { shipments, markDelivered } = useFulfillmentStore();

  const statusVariant = {
    dispatched: "info",
    "in-transit": "warning",
    delivered: "success",
  };

  const statusLabel = {
    dispatched: "Dispatched",
    "in-transit": "In Transit",
    delivered: "Delivered",
  };

  return (
    <main className="dispatch-pages">
      <PageHeader
        eyebrow="Factory Operations / Dispatch & Logistics"
        title="Shipments"
        description="Dispatched consignments: carrier, tracking, dispatch date, expected delivery and delivery status."
      />

      <div className="dispatch-pages__content">
        <section className="dispatch-pages__list-card">
          {shipments.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No shipments"
              description="Shipments are created when ready-for-delivery orders are dispatched."
            />
          ) : (
            <div className="dispatch-pages__table-wrap">
              <table className="dispatch-pages__table">
                <thead>
                  <tr>
                    <th>Shipment</th>
                    <th>Order</th>
                    <th>Carrier</th>
                    <th>Tracking</th>
                    <th>Dispatch Date</th>
                    <th>Expected Delivery</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <td>{shipment.code}</td>

                      <td>{shipment.orderId}</td>

                      <td>{shipment.carrier}</td>

                      <td>{shipment.trackingNumber || "—"}</td>

                      <td>{shipment.dispatchDate}</td>

                      <td>{shipment.expectedDelivery || "—"}</td>

                      <td>
                        <Badge variant={statusVariant[shipment.status]}>
                          {statusLabel[shipment.status]}
                        </Badge>
                      </td>

                      <td>
                        {shipment.status !== "delivered" ? (
                          <Button
                            variant="primary"
                            size="small"
                            icon={CheckCircle2}
                            onClick={() => {
                              markDelivered(shipment.id);
                              toast.success({
                                title: "Delivered",
                                message: `${shipment.code} marked delivered.`,
                              });
                            }}
                          >
                            Mark Delivered
                          </Button>
                        ) : (
                          <span className="dispatch-pages__delivered-date">
                            {shipment.deliveryDate}
                          </span>
                        )}
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
