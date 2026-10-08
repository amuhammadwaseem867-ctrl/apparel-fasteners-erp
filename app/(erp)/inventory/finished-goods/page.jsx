"use client";

import {
  AlertTriangle,
  PackageCheck,
  Search,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { RAW_MATERIAL_CATEGORIES } from "@/config/items";

import "./FinishedGoods.css";

/*
 * Finished Goods — stock of completed, packed zipper items
 * ready for dispatch. Fed by Finished Goods Receipt from
 * packing/completion; drained by Finished Goods Dispatch.
 */

const FINISHED_GOODS = [];

export default function FinishedGoodsPage() {
  return (
    <main className="fg-stock">
      <PageHeader
        eyebrow="Materials & Inventory / Inventory"
        title="Finished Goods"
        description="Completed zipper stock received from packing, held for dispatch and drained by delivery."
      />

      <div className="fg-stock__content">
        <section className="fg-stock__notice">
          <div className="fg-stock__notice-icon">
            <PackageCheck size={17} strokeWidth={1.8} />
          </div>

          <div className="fg-stock__notice-content">
            <strong>Finished goods database not connected</strong>

            <span>
              Finished goods stock will appear once packing
              completions are received into inventory.
            </span>
          </div>
        </section>

        <section className="fg-stock__toolbar">
          <div className="fg-stock__search">
            <Input
              placeholder="Search by SKU, item name, size, material, finish, color, variant, warehouse, location..."
              icon={Search}
            />
          </div>
        </section>

        <section className="fg-stock__list-card">
          {FINISHED_GOODS.length > 0 ? (
            <div className="fg-stock__table" />
          ) : (
            <EmptyState
              icon={PackageCheck}
              title="No finished goods stock"
              description="Completed and packed orders will be received into finished goods inventory once the backend is connected."
            />
          )}
        </section>

        <section className="fg-stock__attention">
          <AlertTriangle size={17} strokeWidth={1.8} />

          <span>
            Finished Goods Receipt and Finished Goods Dispatch are
            inventory movement types, reconciled by backend rules.
          </span>
        </section>
      </div>
    </main>
  );
}
