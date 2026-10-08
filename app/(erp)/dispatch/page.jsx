"use client";

import {
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  Truck,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

import "./DispatchOverview.css";

/*
 * Dispatch & Logistics Overview.
 *
 * Workflow: Packing Complete → Ready for Delivery →
 *           Dispatched → Delivered
 *
 * Order delivery status follows this workflow.
 */

const SHIPMENTS = [];

export default function DispatchOverviewPage() {
  return (
    <main className="dispatch-overview">
      <PageHeader
        eyebrow="Factory Operations / Dispatch & Logistics"
        title="Dispatch & Logistics"
        description="Outbound flow: packed goods become ready for delivery, are dispatched as shipments and confirmed as delivered."
      />

      <div className="dispatch-overview__content">
        <section className="dispatch-overview__workflow">
          <div className="dispatch-overview__workflow-step">
            <span>01</span>
            <strong>Packing Complete</strong>
            <small>Packing sign-off</small>
          </div>

          <div className="dispatch-overview__workflow-line" />

          <div className="dispatch-overview__workflow-step">
            <span>02</span>
            <strong>Ready for Delivery</strong>
            <small>Awaiting dispatch</small>
          </div>

          <div className="dispatch-overview__workflow-line" />

          <div className="dispatch-overview__workflow-step">
            <span>03</span>
            <strong>Dispatched</strong>
            <small>Shipment created</small>
          </div>

          <div className="dispatch-overview__workflow-line" />

          <div className="dispatch-overview__workflow-step">
            <span>04</span>
            <strong>Delivered</strong>
            <small>Customer received</small>
          </div>
        </section>

        <section className="dispatch-overview__kpis">
          <div className="dispatch-overview__kpi">
            <span>Ready for Delivery</span>
            <strong>0</strong>
          </div>

          <div className="dispatch-overview__kpi">
            <span>Dispatched Today</span>
            <strong>0</strong>
          </div>

          <div className="dispatch-overview__kpi">
            <span>In Transit</span>
            <strong>0</strong>
          </div>

          <div className="dispatch-overview__kpi">
            <span>Delivered (MTD)</span>
            <strong>0</strong>
          </div>

          <div className="dispatch-overview__kpi">
            <span>Pending Delivery Confirmation</span>
            <strong>0</strong>
          </div>
        </section>

        <section className="dispatch-overview__list-card">
          {SHIPMENTS.length > 0 ? (
            <div className="dispatch-overview__table" />
          ) : (
            <EmptyState
              icon={Truck}
              title="No shipments"
              description="Shipments will appear here once packed orders are dispatched and the backend is connected."
            />
          )}
        </section>

        <section className="dispatch-overview__attention">
          <AlertTriangle size={17} strokeWidth={1.8} />

          <span>
            Order delivery status follows the outbound workflow and
            is updated by backend rules at each transition.
          </span>
        </section>
      </div>
    </main>
  );
}
