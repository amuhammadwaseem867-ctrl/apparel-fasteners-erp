"use client";

import Link from "next/link";
import {
  Factory,
  TriangleAlert,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import useOrderStore from "@/lib/useOrderStore";
import { PRODUCTION_STAGES } from "@/config/production";

import "./StageBoard.css";

/*
 * Stage Board — live board of all nine production stages.
 * Orders currently inside each stage are shown as cards with
 * their progress and quantities.
 */

export default function StageBoardPage() {
  const { orders, stageProgress, delayed } = useOrderStore([]);

  const columns = PRODUCTION_STAGES.map((stage) => {
    const stageOrders = orders.filter(
      (order) => order.currentStage === stage.key
    );

    const totals = stageOrders.reduce(
      (acc, order) => {
        const stageRecord = order.stages.find(
          (s) => s.stageType === stage.key
        );

        return {
          input: acc.input + (stageRecord?.inputQuantity || 0),
          completed: acc.completed + (stageRecord?.completedQuantity || 0),
          rejected: acc.rejected + (stageRecord?.rejectedQuantity || 0),
          wastage: acc.wastage + (stageRecord?.wastageQuantity || 0),
        };
      },
      { input: 0, completed: 0, rejected: 0, wastage: 0 }
    );

    const delayedCount = stageOrders.filter((order) => {
      const stageRecord = order.stages.find(
        (s) => s.stageType === stage.key
      );

      return (
        stageRecord?.status === "in-progress" &&
        delayed(order)
      );
    }).length;

    return { ...stage, orders: stageOrders, totals, delayedCount };
  });

  const hasOrders = orders.length > 0;

  return (
    <main className="stage-board">
      <PageHeader
        eyebrow="Factory Operations / Production"
        title="Stage Board"
        description="Live board of all nine production stages. Each order sits in exactly one stage; quantities carry forward from stage to stage."
        action={
          <Link href="/production/orders">
            <Button variant="secondary" icon={Factory}>
              Production Orders
            </Button>
          </Link>
        }
      />

      <div className="stage-board__content">
        {!hasOrders ? (
          <section className="stage-board__list-card">
            <EmptyState
              icon={Factory}
              title="Stage board is empty"
              description="No orders exist yet. Create an order from the Orders list, confirm it and start the first stage to see it on the board."
              action={
                <Link href="/sales/orders/new">
                  <Button variant="primary">Create First Order</Button>
                </Link>
              }
            />
          </section>
        ) : (
          <section className="stage-board__columns">
            {columns.map((column) => (
              <div
                className="stage-board__column"
                key={column.key}
                data-stage={column.key}
              >
                <div className="stage-board__column-head">
                  <span className="stage-board__column-seq">
                    {String(column.sequence).padStart(2, "0")}
                  </span>

                  <div className="stage-board__column-title">
                    <strong>{column.label}</strong>

                    <small>{column.department}</small>
                  </div>

                  <span className="stage-board__column-count">
                    {column.orders.length}
                  </span>
                </div>

                <div className="stage-board__column-qty">
                  <span>
                    In <b>{column.totals.input.toLocaleString()}</b>
                  </span>

                  <span>
                    Out <b>{column.totals.completed.toLocaleString()}</b>
                  </span>

                  <span className="stage-board__qty-reject">
                    Rej <b>{column.totals.rejected.toLocaleString()}</b>
                  </span>

                  <span className="stage-board__qty-waste">
                    Waste <b>{column.totals.wastage.toLocaleString()}</b>
                  </span>
                </div>

                <div className="stage-board__column-body">
                  {column.orders.length === 0 ? (
                    <div className="stage-board__column-empty">
                      No orders in this stage
                    </div>
                  ) : (
                    column.orders.map((order) => (
                      <Link
                        href={`/sales/orders/${order.id}`}
                        className="stage-board__order-card"
                        key={order.id}
                      >
                        <strong>{order.orderNumber}</strong>

                        <span>{order.customerName || "—"}</span>

                        <small>
                          {order.requiredQuantity.toLocaleString()}{" "}
                          {order.unit} · {stageProgress(order)}%
                        </small>

                        {order.status === "on-hold" && <em>On Hold</em>}
                      </Link>
                    ))
                  )}
                </div>

                {column.delayedCount > 0 && (
                  <div className="stage-board__column-delayed">
                    <TriangleAlert size={13} strokeWidth={2} />
                    {column.delayedCount} delayed
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
