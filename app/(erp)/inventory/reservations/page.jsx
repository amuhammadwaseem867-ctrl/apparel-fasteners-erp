"use client";

import {
  Boxes,
  Lock,
  Search,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./Reservations.css";

/*
 * Inventory Reservations — stock reserved against customer
 * orders (movement type: Stock Reservation Against Order).
 *
 * Reservation record (backend entity mirror):
 * { orderId, itemId, quantity, warehouse, status, createdAt }
 */

const RESERVATIONS = [];

export default function ReservationsPage() {
  return (
    <main className="inv-reservations">
      <PageHeader
        eyebrow="Materials & Inventory / Inventory"
        title="Reservations"
        description="Stock reserved against customer orders. Reserved stock reduces available stock until released or consumed."
      />

      <div className="inv-reservations__content">
        <section className="inv-reservations__toolbar">
          <div className="inv-reservations__search">
            <Input
              placeholder="Search by order, item, warehouse..."
              icon={Search}
            />
          </div>
        </section>

        <section className="inv-reservations__list-card">
          {RESERVATIONS.length > 0 ? (
            <div className="inv-reservations__table" />
          ) : (
            <EmptyState
              icon={Lock}
              title="No reservations"
              description="Stock reservations against orders will appear here once the backend is connected."
            />
          )}
        </section>

        <section className="inv-reservations__hint">
          <Boxes size={17} strokeWidth={1.8} />

          <span>
            Available Stock = Current Stock − Reserved Stock.
            Reservations are visible on Item Master per item.
          </span>
        </section>
      </div>
    </main>
  );
}
