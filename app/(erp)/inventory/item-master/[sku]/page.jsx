"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

import { MOVEMENT_TYPES } from "@/config/items";

import "./ItemProfile.css";

/*
 * Item Profile — complete stock lifecycle for one SKU:
 * item information, stock summary, movements, reservations,
 * WIP, related orders, batch/lot and adjustment history.
 *
 * All quantities come from the backend once connected; the
 * page renders structured empty states until then.
 */

export default function ItemProfilePage() {
  const params = useParams();

  const sku = params?.sku;

  return (
    <main className="item-profile">
      <PageHeader
        eyebrow="Materials & Inventory / Item Master"
        title={sku ? `Item ${decodeURIComponent(sku)}` : "Item Profile"}
        description="Complete stock lifecycle for this specification: stock summary, movements, reservations, WIP, related orders and batch history."
        action={
          <Link href="/inventory/item-master">
            <Button variant="secondary" icon={ArrowLeft}>
              Item Master
            </Button>
          </Link>
        }
      />

      <div className="item-profile__content">
        {/* STOCK SUMMARY */}
        <section className="item-profile__card">
          <h2>Stock Summary</h2>

          <div className="item-profile__grid item-profile__grid--stats">
            {[
              ["Current Stock", "—"],
              ["Reserved Stock", "—"],
              ["Available Stock", "—"],
              ["WIP Stock", "—"],
              ["Minimum Level", "—"],
              ["Stock Status", "Backend"],
            ].map(([label, value]) => (
              <div className="item-profile__stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <p className="item-profile__note">
            Stock figures load from the inventory backend once
            connected. Available = Current − Reserved.
          </p>
        </section>

        {/* ITEM INFORMATION */}
        <section className="item-profile__card">
          <h2>Item Information</h2>

          <div className="item-profile__grid item-profile__grid--info">
            {[
              "SKU / Item Code",
              "Item Name",
              "Category",
              "Subcategory",
              "Size",
              "Material",
              "Type",
              "Finish",
              "Color",
              "Variant",
              "Logo / Plain",
              "Unit",
            ].map((label) => (
              <div className="item-profile__info" key={label}>
                <span>{label}</span>
                <strong>—</strong>
              </div>
            ))}
          </div>
        </section>

        {/* WAREHOUSE LOCATIONS */}
        <section className="item-profile__card">
          <h2>Warehouse Locations</h2>

          <div className="item-profile__empty">
            <span>
              Warehouse and bin locations appear once the backend is
              connected.
            </span>
          </div>
        </section>

        {/* MOVEMENTS */}
        <section className="item-profile__card">
          <h2>Stock Movements</h2>

          <div className="item-profile__chips">
            {MOVEMENT_TYPES.map((type) => (
              <span key={type.id}>{type.label}</span>
            ))}
          </div>

          <div className="item-profile__empty">
            <span>
              No movements recorded for this item yet. Transactions
              (Goods Receipt, Issue, Transfer, Adjustment, FG
              Receipt/Dispatch) will be listed here with date,
              quantity, warehouse, reference and user.
            </span>
          </div>
        </section>

        {/* RESERVATIONS + RELATED ORDERS */}
        <div className="item-profile__row">
          <section className="item-profile__card">
            <h2>Reservations</h2>

            <div className="item-profile__empty">
              <span>
                Stock reserved against customer orders for this item
                will appear here.
              </span>
            </div>
          </section>

          <section className="item-profile__card">
            <h2>Related Orders</h2>

            <div className="item-profile__empty">
              <span>
                Customer orders consuming this item will appear
                here.
              </span>
            </div>
          </section>
        </div>

        {/* BATCH + ADJUSTMENTS */}
        <div className="item-profile__row">
          <section className="item-profile__card">
            <h2>Batch / Lot History</h2>

            <div className="item-profile__empty">
              <span>
                Batch and lot records for this item will appear
                here where batch tracking applies.
              </span>
            </div>
          </section>

          <section className="item-profile__card">
            <h2>Stock Adjustment History</h2>

            <div className="item-profile__empty">
              <span>
                Adjustments, damaged and rejected stock records for
                this item will appear here.
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
