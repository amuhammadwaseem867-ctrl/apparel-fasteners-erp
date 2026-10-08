"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Eye,
  CalendarDays,
  Factory,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./ProductionPlans.css";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    className: "draft",
  },
  planned: {
    label: "Planned",
    className: "planned",
  },
  released: {
    label: "Released",
    className: "released",
  },
  in_progress: {
    label: "In Progress",
    className: "progress",
  },
  completed: {
    label: "Completed",
    className: "completed",
  },
  cancelled: {
    label: "Cancelled",
    className: "cancelled",
  },
};

export default function ProductionPlansPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  /*
   * Backend integration point.
   *
   * Production plans will later be loaded from:
   * - MRP results
   * - Sales orders
   * - BOM
   * - Production capacity
   * - Material reservations
   *
   * No mock records are intentionally used.
   */
  const plans = useMemo(() => [], []);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const searchableText = [
        plan.reference,
        plan.name,
        plan.productName,
        plan.productCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        searchableText.includes(
          search.toLowerCase()
        );

      const matchesStatus =
        status === "all" ||
        plan.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [plans, search, status]);

  const handleCreatePlan = () => {
    /*
     * Production plan creation flow will be
     * connected to backend later.
     */
  };

  const handleRefresh = () => {
    /*
     * API refresh will be implemented here.
     */
  };

  const handleView = (plan) => {
    /*
     * Navigate to production plan detail later.
     */
    /* Backend integration pending. */
  };

  return (
    <main className="production-plans">
      <PageHeader
        eyebrow="PLANNING / PRODUCTION PLANS"
        title="Production Plans"
        description="Convert planned demand and material requirements into executable production schedules."
        action={
          <div className="production-plans__header-actions">
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
              onClick={handleCreatePlan}
            >
              Create Plan
            </Button>
          </div>
        }
      />

      <div className="production-plans__content">
        <section className="production-plans__toolbar">
          <div className="production-plans__search">
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
              placeholder="Search plan, product or code..."
              aria-label="Search production plans"
            />
          </div>

          <div className="production-plans__filters">
            <label htmlFor="production-plan-status">
              Status
            </label>

            <select
              id="production-plan-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="draft">
                Draft
              </option>

              <option value="planned">
                Planned
              </option>

              <option value="released">
                Released
              </option>

              <option value="in_progress">
                In Progress
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>
          </div>
        </section>

        <section className="production-plans__table-card">
          <div className="production-plans__table-header">
            <div>
              <h2>Production Plan Register</h2>

              <p>
                {plans.length} plan
                {plans.length === 1 ? "" : "s"} available
              </p>
            </div>

            <div className="production-plans__summary">
              <span>
                Planned: —
              </span>

              <span>
                In Progress: —
              </span>

              <span>
                Completed: —
              </span>
            </div>
          </div>

          {filteredPlans.length > 0 ? (
            <div className="production-plans__table-wrap">
              <table className="production-plans__table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Work Center</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPlans.map((plan) => {
                    const statusConfig =
                      STATUS_CONFIG[plan.status] ||
                      STATUS_CONFIG.draft;

                    return (
                      <tr key={plan.id}>
                        <td>
                          <div className="production-plans__plan">
                            <strong>
                              {plan.reference || "—"}
                            </strong>

                            <span>
                              {plan.name ||
                                "Production Plan"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="production-plans__product">
                            <span>
                              {plan.productName ||
                                "—"}
                            </span>

                            {plan.productCode && (
                              <small>
                                {plan.productCode}
                              </small>
                            )}
                          </div>
                        </td>

                        <td>
                          {plan.quantity ?? "—"}
                        </td>

                        <td>
                          <span className="production-plans__date">
                            <CalendarDays
                              size={14}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />

                            {plan.startDate || "—"}
                          </span>
                        </td>

                        <td>
                          <span className="production-plans__date">
                            <CalendarDays
                              size={14}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />

                            {plan.endDate || "—"}
                          </span>
                        </td>

                        <td>
                          {plan.workCenter || "—"}
                        </td>

                        <td>
                          {plan.priority || "—"}
                        </td>

                        <td>
                          <span
                            className={`production-plans__status production-plans__status--${statusConfig.className}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>

                        <td>
                          <Button
                            variant="ghost"
                            size="small"
                            icon={Eye}
                            onClick={() =>
                              handleView(plan)
                            }
                            aria-label={`View ${plan.reference}`}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Factory}
              title="No production plans"
              description={
                search || status !== "all"
                  ? "No production plans match the selected filters."
                  : "Production plans generated from planning requirements will appear here."
              }
              action={
                !search && status === "all" ? (
                  <Button
                    variant="primary"
                    size="md"
                    icon={Plus}
                    onClick={handleCreatePlan}
                  >
                    Create Production Plan
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