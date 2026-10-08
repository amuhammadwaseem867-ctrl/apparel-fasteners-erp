"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Eye,
  LockKeyhole,
  PackageCheck,
  Clock3,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./MaterialReservations.css";

const STATUS_CONFIG = {
  reserved: {
    label: "Reserved",
    icon: PackageCheck,
    className: "success",
  },
  pending: {
    label: "Pending",
    icon: Clock3,
    className: "warning",
  },
  partially_reserved: {
    label: "Partially Reserved",
    icon: Clock3,
    className: "info",
  },
  released: {
    label: "Released",
    icon: XCircle,
    className: "neutral",
  },
};

export default function MaterialReservationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  /*
   * Backend integration point.
   *
   * Reservation records will later come from:
   *
   * MRP Requirements
   *       ↓
   * Available Inventory
   *       ↓
   * Reservation Service
   *       ↓
   * Production / Sales Demand
   *
   * No mock records are intentionally used.
   */
  const reservations = useMemo(() => [], []);

  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      const searchableText = [
        reservation.reference,
        reservation.materialName,
        reservation.materialCode,
        reservation.demandReference,
        reservation.productName,
        reservation.warehouseName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        searchableText.includes(search.toLowerCase());

      const matchesStatus =
        status === "all" ||
        reservation.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [reservations, search, status]);

  const handleCreateReservation = () => {
    /*
     * Reservation creation flow will be connected
     * to the backend later.
     */
  };

  const handleRefresh = () => {
    /*
     * API refresh will be implemented later.
     */
  };

  const handleView = (reservation) => {
    /*
     * Navigate to reservation detail later.
     */
    /* Backend integration pending. */
  };

  return (
    <main className="material-reservations">
      <PageHeader
        eyebrow="PLANNING / MATERIAL RESERVATIONS"
        title="Material Reservations"
        description="Reserve available inventory against production demand, sales requirements, and planned material requirements."
        action={
          <div className="material-reservations__header-actions">
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCw}
              onClick={handleRefresh}
            >
              Refresh
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleCreateReservation}
            >
              Create Reservation
            </Button>
          </div>
        }
      />

      <div className="material-reservations__content">
        <section className="material-reservations__info">
          <div className="material-reservations__info-icon">
            <LockKeyhole
              size={20}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2>Inventory Reservation</h2>

            <p>
              Reserved quantities are protected from
              other planning and allocation activities
              until they are released or consumed.
            </p>
          </div>
        </section>

        <section className="material-reservations__toolbar">
          <div className="material-reservations__search">
            <Search
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search reservation, material, demand..."
              aria-label="Search material reservations"
            />
          </div>

          <div className="material-reservations__filters">
            <label htmlFor="reservation-status">
              Status
            </label>

            <select
              id="reservation-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="reserved">
                Reserved
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="partially_reserved">
                Partially Reserved
              </option>

              <option value="released">
                Released
              </option>
            </select>
          </div>
        </section>

        <section className="material-reservations__table-card">
          <div className="material-reservations__table-header">
            <div>
              <h2>Reservation Register</h2>

              <p>
                {reservations.length} reservation
                {reservations.length === 1
                  ? ""
                  : "s"} available
              </p>
            </div>

            <div className="material-reservations__summary">
              <span>
                Reserved: —
              </span>

              <span>
                Pending: —
              </span>

              <span>
                Partial: —
              </span>
            </div>
          </div>

          {filteredReservations.length > 0 ? (
            <div className="material-reservations__table-wrap">
              <table className="material-reservations__table">
                <thead>
                  <tr>
                    <th>Reservation</th>
                    <th>Material</th>
                    <th>Demand</th>
                    <th>Warehouse</th>
                    <th>Required</th>
                    <th>Reserved</th>
                    <th>Remaining</th>
                    <th>Required Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReservations.map(
                    (reservation) => {
                      const statusConfig =
                        STATUS_CONFIG[
                          reservation.status
                        ] ||
                        STATUS_CONFIG.pending;

                      const StatusIcon =
                        statusConfig.icon;

                      return (
                        <tr key={reservation.id}>
                          <td>
                            <div className="material-reservations__reference">
                              <strong>
                                {reservation.reference ||
                                  "—"}
                              </strong>

                              <span>
                                {reservation.name ||
                                  "Material Reservation"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="material-reservations__material">
                              <strong>
                                {reservation.materialName ||
                                  "—"}
                              </strong>

                              <span>
                                {reservation.materialCode ||
                                  "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="material-reservations__demand">
                              <strong>
                                {reservation.demandReference ||
                                  "—"}
                              </strong>

                              {reservation.productName && (
                                <span>
                                  {
                                    reservation.productName
                                  }
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            {reservation.warehouseName ||
                              "—"}
                          </td>

                          <td>
                            {reservation.requiredQuantity ??
                              "—"}
                          </td>

                          <td>
                            <strong>
                              {reservation.reservedQuantity ??
                                "—"}
                            </strong>
                          </td>

                          <td>
                            {reservation.remainingQuantity ??
                              "—"}
                          </td>

                          <td>
                            {reservation.requiredDate ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={`material-reservations__status material-reservations__status--${statusConfig.className}`}
                            >
                              <StatusIcon
                                size={13}
                                strokeWidth={1.9}
                                aria-hidden="true"
                              />

                              {statusConfig.label}
                            </span>
                          </td>

                          <td>
                            <Button
                              variant="ghost"
                              size="small"
                              icon={Eye}
                              onClick={() =>
                                handleView(
                                  reservation
                                )
                              }
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={LockKeyhole}
              title="No material reservations"
              description={
                search || status !== "all"
                  ? "No reservations match the selected filters."
                  : "Material reservations created against planning requirements will appear here."
              }
              action={
                !search && status === "all" ? (
                  <Button
                    variant="primary"
                    size="md"
                    icon={Plus}
                    onClick={
                      handleCreateReservation
                    }
                  >
                    Create Reservation
                  </Button>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}