"use client";

import { Truck } from "lucide-react";
import Link from "next/link";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import useFulfillmentStore from "@/lib/useFulfillmentStore";

import "../DispatchPages.css";

export default function DispatchPage() {
  const { readyOrders } = useFulfillmentStore();

  return (
    <main className="dispatch-pages">
      <PageHeader
        eyebrow="Factory Operations / Dispatch & Logistics"
        title="Dispatch"
        description="Create dispatches from ready-for-delivery orders. Dispatching moves the order to Shipments."
      />

      <div className="dispatch-pages__content">
        <section className="dispatch-pages__list-card">
          {readyOrders.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Nothing to dispatch"
              description="Mark completed packing orders as ready for delivery from the Packing module, then dispatch them from the Ready for Delivery page."
              action={
                <Link href="/dispatch/ready">
                  <Button variant="primary">Go to Ready for Delivery</Button>
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={Truck}
              title={`${readyOrders.length} order(s) ready`}
              description="Dispatch them from the Ready for Delivery page."
              action={
                <Link href="/dispatch/ready">
                  <Button variant="primary">Go to Ready for Delivery</Button>
                </Link>
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
