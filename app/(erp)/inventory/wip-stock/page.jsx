"use client";

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Search,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { PRODUCTION_STAGES } from "@/config/production";

import "./WipStock.css";

/*
 * WIP Stock — connects Inventory and Production.
 *
 * Required flow:
 *   Warehouse → Material Issue → Production → WIP →
 *   Next Production Stage → Finished Goods
 *
 * Tracked per order/material:
 *   Required, Issued, Consumed, Returned, Wasted, Remaining
 *
 * WIP record (backend entity mirror):
 * { orderId, workOrderId, stageKey, itemId,
 *   requiredQuantity, issuedQuantity, consumedQuantity,
 *   returnedQuantity, wastedQuantity, remainingQuantity }
 */

const WIP_RECORDS = [];

export default function WipStockPage() {
  return (
    <main className="wip-stock">
      <PageHeader
        eyebrow="Materials & Inventory / Inventory"
        title="WIP Stock"
        description="Work-in-progress stock tracked against orders and production stages — from material issue through every stage to finished goods."
      />

      <div className="wip-stock__content">
        <section className="wip-stock__flow">
          <div className="wip-stock__flow-track">
            <span className="wip-stock__flow-node">Warehouse</span>
            <ArrowRight size={14} strokeWidth={2} className="wip-stock__flow-arrow" />
            <span className="wip-stock__flow-node">Material Issue</span>
            <ArrowRight size={14} strokeWidth={2} className="wip-stock__flow-arrow" />
            <span className="wip-stock__flow-node">Production</span>
            <ArrowRight size={14} strokeWidth={2} className="wip-stock__flow-arrow" />
            <span className="wip-stock__flow-node wip-stock__flow-node--highlight">WIP</span>
            <ArrowRight size={14} strokeWidth={2} className="wip-stock__flow-arrow" />
            <span className="wip-stock__flow-node">Next Production Stage</span>
            <ArrowRight size={14} strokeWidth={2} className="wip-stock__flow-arrow" />
            <span className="wip-stock__flow-node">Finished Goods</span>
          </div>
        </section>

        <section className="wip-stock__stages">
          {PRODUCTION_STAGES.filter(
            (stage) => !["quality-check", "packing", "delivered"].includes(stage.key)
          ).map((stage) => (
            <div className="wip-stock__stage" key={stage.key}>
              <div className="wip-stock__stage-head">
                <strong>{stage.label}</strong>

                <span>0 records</span>
              </div>

              <div className="wip-stock__stage-qty">
                <span>
                  Required <b>0</b>
                </span>

                <span>
                  Issued <b>0</b>
                </span>

                <span>
                  Consumed <b>0</b>
                </span>

                <span>
                  Returned <b>0</b>
                </span>

                <span className="wip-stock__qty-waste">
                  Wasted <b>0</b>
                </span>

                <span className="wip-stock__qty-remaining">
                  Remaining <b>0</b>
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="wip-stock__toolbar">
          <div className="wip-stock__search">
            <Input
              placeholder="Search by order, work order, item, stage..."
              icon={Search}
            />
          </div>
        </section>

        <section className="wip-stock__list-card">
          {WIP_RECORDS.length > 0 ? (
            <div className="wip-stock__table" />
          ) : (
            <EmptyState
              icon={Boxes}
              title="No WIP records"
              description="WIP stock appears once materials are issued to production and the backend is connected."
            />
          )}
        </section>

        <section className="wip-stock__attention">
          <AlertTriangle size={17} strokeWidth={1.8} />

          <span>
            WIP quantities are maintained per order and material.
            Remaining = Required − Issued adjustments and stage
            consumption, enforced by backend rules.
          </span>
        </section>
      </div>
    </main>
  );
}
