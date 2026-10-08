"use client";

import { CheckCircle2 } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

import useFulfillmentStore from "@/lib/useFulfillmentStore";

import "../DispatchPages.css";

export default function DeliveredPage() {
  const { shipments } = useFulfillmentStore();

  const delivered = shipments.filter(
    (shipment) => shipment.status === "delivered"
  );

  return (
    <main className="dispatch-pages">
      <PageHeader
        eyebrow="Factory Operations / Dispatch & Logistics"
        title="Delivered"
        description="Shipments confirmed as delivered. Order status and delivery status close out here."
      />

      <div className="dispatch-pages__content">
        <section className="dispatch-pages__list-card">
          {delivered.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No deliveries yet"
              description="Delivered records appear when shipments are marked delivered from the Shipments page."
            />
          ) : (
            <div className="dispatch-pages__table-wrap">
              <table className="dispatch-pages__table">
                <thead>
                  <tr>
                    <th>Shipment</th>
                    <th>Order</th>
                    <th>Carrier</th>
                    <th>Dispatch Date</th>
                    <th>Delivery Date</th>
                  </tr>
                </thead>

                <tbody>
                  {delivered.map((shipment) => (
                    <tr key={shipment.id}>
                      <td>{shipment.code}</td>

                      <td>{shipment.orderId}</td>

                      <td>{shipment.carrier}</td>

                      <td>{shipment.dispatchDate}</td>

                      <td>{shipment.deliveryDate}</td>
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
