"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Package,
  PackageCheck,
  Plus,
  Search,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./PackingOverview.css";

/*
 * Packing Overview.
 *
 * Workflow: QC Approved → Packing → Ready for Delivery
 *
 * Packing record (backend entity mirror):
 * { orderId, product, approvedQuantity, packedQuantity,
 *   remainingQuantity, packageType, packageCount, weight,
 *   dimensions, packingInstructions, specialInstructions,
 *   packedBy, packedAt }
 */

const PACKING_ORDERS = [];

export default function PackingOverviewPage() {
  return (
    <main className="packing-overview">
      <PageHeader
        eyebrow="Factory Operations / Packing"
        title="Packing"
        description="Packing of QC-approved finished zippers into customer packages, ready for delivery."
        action={
          <Link href="/packing/orders">
            <Button variant="primary" icon={Plus}>
              New Packing Order
            </Button>
          </Link>
        }
      />

      <div className="packing-overview__content">
        <section className="packing-overview__workflow">
          <div className="packing-overview__workflow-step">
            <span>01</span>
            <strong>QC Approved</strong>
            <small>Final inspection passed</small>
          </div>

          <div className="packing-overview__workflow-line" />

          <div className="packing-overview__workflow-step">
            <span>02</span>
            <strong>Packing</strong>
            <small>Pack into packages</small>
          </div>

          <div className="packing-overview__workflow-line" />

          <div className="packing-overview__workflow-step">
            <span>03</span>
            <strong>Ready for Delivery</strong>
            <small>Handoff to dispatch</small>
          </div>
        </section>

        <section className="packing-overview__kpis">
          <div className="packing-overview__kpi">
            <span>Packing Orders Open</span>
            <strong>0</strong>
          </div>

          <div className="packing-overview__kpi">
            <span>QC Approved Awaiting Packing</span>
            <strong>0</strong>
          </div>

          <div className="packing-overview__kpi">
            <span>Approved Qty</span>
            <strong>0</strong>
          </div>

          <div className="packing-overview__kpi">
            <span>Packed Qty</span>
            <strong>0</strong>
          </div>

          <div className="packing-overview__kpi">
            <span>Remaining Qty</span>
            <strong>0</strong>
          </div>
        </section>

        <section className="packing-overview__toolbar">
          <div className="packing-overview__search">
            <Input
              placeholder="Search packing orders by order number, customer, SKU..."
              icon={Search}
            />
          </div>
        </section>

        <section className="packing-overview__list-card">
          {PACKING_ORDERS.length > 0 ? (
            <div className="packing-overview__table" />
          ) : (
            <EmptyState
              icon={PackageCheck}
              title="No packing activity"
              description="Packing orders appear here once QC-approved quantities are released for packing and the backend is connected."
            />
          )}
        </section>

        <section className="packing-overview__attention">
          <AlertTriangle size={17} strokeWidth={1.8} />

          <span>
            Packing quantity cannot exceed QC-approved quantity.
            Workflow transitions are enforced by backend rules.
          </span>
        </section>
      </div>
    </main>
  );
}
