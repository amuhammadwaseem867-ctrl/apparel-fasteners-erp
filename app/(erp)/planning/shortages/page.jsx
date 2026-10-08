"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw,
  Search,
  Eye,
  AlertTriangle,
  ShoppingCart,
  Factory,
  LockKeyhole,
  PackageSearch,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

import "./Shortages.css";

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    className: "critical",
  },
  high: {
    label: "High",
    className: "high",
  },
  medium: {
    label: "Medium",
    className: "medium",
  },
  low: {
    label: "Low",
    className: "low",
  },
};

const STATUS_CONFIG = {
  open: {
    label: "Open",
    className: "open",
  },
  reviewing: {
    label: "Reviewing",
    className: "reviewing",
  },
  procurement: {
    label: "Procurement",
    className: "procurement",
  },
  production: {
    label: "Production",
    className: "production",
  },
  resolved: {
    label: "Resolved",
    className: "resolved",
  },
};

const ACTION_CONFIG = {
  purchase: {
    label: "Purchase",
    icon: ShoppingCart,
  },
  produce: {
    label: "Produce",
    icon: Factory,
  },
  reserve: {
    label: "Reserve",
    icon: LockKeyhole,
  },
  review: {
    label: "Review",
    icon: PackageSearch,
  },
};

export default function ShortagesPage() {
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");

  /*
   * Backend integration point.
   *
   * Shortages will later be generated from:
   *
   * Material Requirements
   *        +
   * Available Inventory
   *        +
   * Reservations
   *        +
   * Incoming Supply
   *        ↓
   *     MRP Engine
   *        ↓
   *    Shortage Records
   *
   * No mock records are intentionally used.
   */
  const shortages = useMemo(() => [], []);

  const filteredShortages = useMemo(() => {
    return shortages.filter((shortage) => {
      const searchableText = [
        shortage.reference,
        shortage.materialName,
        shortage.materialCode,
        shortage.productName,
        shortage.demandReference,
        shortage.warehouseName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        searchableText.includes(
          search.toLowerCase()
        );

      const matchesPriority =
        priority === "all" ||
        shortage.priority === priority;

      const matchesStatus =
        status === "all" ||
        shortage.status === status;

      return (
        matchesSearch &&
        matchesPriority &&
        matchesStatus
      );
    });
  }, [
    shortages,
    search,
    priority,
    status,
  ]);

  const handleRefresh = () => {
    /*
     * API refresh will be implemented later.
     */
  };

  const handleView = () => {
    toast.info({
      title: 'Shortage detail',
      message: 'Shortage detail opens when the planning API is connected.',
    });
  };

  const handleAction = () => {
    toast.info({
      title: 'Action started',
      message: 'Shortage resolution calls the planning API when connected.',
    });
  };

  return (
    <main className="shortages">
      <PageHeader
        eyebrow="PLANNING / SHORTAGES"
        title="Material Shortages"
        description="Identify material gaps affecting demand and coordinate procurement, production, or reservation actions."
        action={
          <Button
            variant="primary"
            size="md"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
      />

      <div className="shortages__content">
        <section className="shortages__alert">
          <div className="shortages__alert-icon">
            <AlertTriangle
              size={20}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2>
              Shortage Exception Monitor
            </h2>

            <p>
              Review supply gaps before they affect
              production schedules or customer
              commitments.
            </p>
          </div>
        </section>

        <section className="shortages__toolbar">
          <div className="shortages__search">
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
              placeholder="Search material, product, demand..."
              aria-label="Search shortages"
            />
          </div>

          <div className="shortages__filters">
            <div className="shortages__filter">
              <label htmlFor="shortage-priority">
                Priority
              </label>

              <select
                id="shortage-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All priorities
                </option>

                <option value="critical">
                  Critical
                </option>

                <option value="high">
                  High
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="low">
                  Low
                </option>
              </select>
            </div>

            <div className="shortages__filter">
              <label htmlFor="shortage-status">
                Status
              </label>

              <select
                id="shortage-status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>

                <option value="open">
                  Open
                </option>

                <option value="reviewing">
                  Reviewing
                </option>

                <option value="procurement">
                  Procurement
                </option>

                <option value="production">
                  Production
                </option>

                <option value="resolved">
                  Resolved
                </option>
              </select>
            </div>
          </div>
        </section>

        <section className="shortages__table-card">
          <div className="shortages__table-header">
            <div>
              <h2>
                Shortage Register
              </h2>

              <p>
                {shortages.length} shortage
                {shortages.length === 1
                  ? ""
                  : "s"} identified
              </p>
            </div>

            <div className="shortages__summary">
              <span>
                Critical: —
              </span>

              <span>
                Open: —
              </span>

              <span>
                Resolved: —
              </span>
            </div>
          </div>

          {filteredShortages.length > 0 ? (
            <div className="shortages__table-wrap">
              <table className="shortages__table">
                <thead>
                  <tr>
                    <th>Shortage</th>
                    <th>Material</th>
                    <th>Demand</th>
                    <th>Required</th>
                    <th>Available</th>
                    <th>Incoming</th>
                    <th>Shortage Qty</th>
                    <th>Required Date</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredShortages.map(
                    (shortage) => {
                      const priorityConfig =
                        PRIORITY_CONFIG[
                          shortage.priority
                        ] ||
                        PRIORITY_CONFIG.medium;

                      const statusConfig =
                        STATUS_CONFIG[
                          shortage.status
                        ] ||
                        STATUS_CONFIG.open;

                      const actionConfig =
                        ACTION_CONFIG[
                          shortage.recommendedAction
                        ] ||
                        ACTION_CONFIG.review;

                      const ActionIcon =
                        actionConfig.icon;

                      return (
                        <tr key={shortage.id}>
                          <td>
                            <div className="shortages__reference">
                              <strong>
                                {shortage.reference ||
                                  "—"}
                              </strong>

                              <span>
                                {shortage.warehouseName ||
                                  "Warehouse pending"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="shortages__material">
                              <strong>
                                {shortage.materialName ||
                                  "—"}
                              </strong>

                              <span>
                                {shortage.materialCode ||
                                  "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="shortages__demand">
                              <strong>
                                {shortage.demandReference ||
                                  "—"}
                              </strong>

                              <span>
                                {shortage.productName ||
                                  "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            {shortage.requiredQuantity ??
                              "—"}
                          </td>

                          <td>
                            {shortage.availableQuantity ??
                              "—"}
                          </td>

                          <td>
                            {shortage.incomingQuantity ??
                              "—"}
                          </td>

                          <td className="shortages__quantity">
                            {shortage.shortageQuantity ??
                              "—"}
                          </td>

                          <td>
                            {shortage.requiredDate ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={`shortages__priority shortages__priority--${priorityConfig.className}`}
                            >
                              {priorityConfig.label}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`shortages__status shortages__status--${statusConfig.className}`}
                            >
                              {statusConfig.label}
                            </span>
                          </td>

                          <td>
                            <div className="shortages__actions">
                              <Button
                                variant="ghost"
                                size="small"
                                icon={ActionIcon}
                                onClick={() =>
                                  handleAction()
                                }
                              >
                                {actionConfig.label}
                              </Button>

                              <Button
                                variant="ghost"
                                size="small"
                                icon={Eye}
                                onClick={() =>
                                  handleView()
                                }
                                aria-label={`View ${shortage.reference}`}
                              >
                                View
                              </Button>
                            </div>
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
              icon={AlertTriangle}
              title="No material shortages"
              description={
                search ||
                priority !== "all" ||
                status !== "all"
                  ? "No shortages match the selected filters."
                  : "Material shortages detected by MRP will appear here."
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}