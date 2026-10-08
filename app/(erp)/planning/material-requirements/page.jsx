"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./MaterialRequirements.css";

export default function MaterialRequirementsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  /*
   * Backend integration point.
   *
   * Material requirements will later come from:
   * Sales Orders
   * + BOM Explosion
   * + Inventory Availability
   * + Open Procurement
   * + Reservations
   *
   * No mock records are intentionally used.
   */
  const requirements = useMemo(() => [], []);

  const filteredRequirements = useMemo(() => {
    if (!search && status === "all") {
      return requirements;
    }

    return requirements.filter((item) => {
      const searchableText = [
        item.materialName,
        item.materialCode,
        item.productName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        searchableText.includes(search.toLowerCase());

      const matchesStatus =
        status === "all" ||
        item.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [requirements, search, status]);

  const handleRefresh = () => {
    /*
     * API refresh will be implemented here.
     */
  };

  const handleExport = () => {
    /*
     * Export logic will be implemented later.
     */
  };

  const hasData = filteredRequirements.length > 0;

  return (
    <main className="material-requirements">
      <PageHeader
        eyebrow="PLANNING / MATERIAL REQUIREMENTS"
        title="Material Requirements"
        description="Review calculated material demand against available inventory, reservations, and incoming supply."
        action={
          <div className="material-requirements__header-actions">
            <Button
              variant="secondary"
              size="md"
              icon={Download}
              onClick={handleExport}
            >
              Export
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={RefreshCw}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="material-requirements__content">
        <section className="material-requirements__toolbar">
          <div className="material-requirements__search">
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
              placeholder="Search material, code or product..."
              aria-label="Search material requirements"
            />
          </div>

          <div className="material-requirements__filters">
            <div className="material-requirements__filter">
              <Filter
                size={15}
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <label htmlFor="requirement-status">
                Status
              </label>

              <select
                id="requirement-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
              >
                <option value="all">
                  All
                </option>
                <option value="covered">
                  Covered
                </option>
                <option value="pending">
                  Pending
                </option>
                <option value="shortage">
                  Shortage
                </option>
              </select>
            </div>
          </div>
        </section>

        <section className="material-requirements__table-card">
          <div className="material-requirements__table-header">
            <div>
              <h2>
                Requirements
              </h2>

              <p>
                {requirements.length} material
                {requirements.length === 1
                  ? ""
                  : "s"} available
              </p>
            </div>
          </div>

          {hasData ? (
            <div className="material-requirements__table-wrap">
              <table className="material-requirements__table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Product</th>
                    <th>Required</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Incoming</th>
                    <th>Net Requirement</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequirements.map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.materialName || "—"}
                          </strong>

                          <span>
                            {item.materialCode || "—"}
                          </span>
                        </td>

                        <td>
                          {item.productName || "—"}
                        </td>

                        <td>
                          {item.requiredQuantity ?? "—"}
                        </td>

                        <td>
                          {item.availableQuantity ?? "—"}
                        </td>

                        <td>
                          {item.reservedQuantity ?? "—"}
                        </td>

                        <td>
                          {item.incomingQuantity ?? "—"}
                        </td>

                        <td>
                          <strong>
                            {item.netRequirement ?? "—"}
                          </strong>
                        </td>

                        <td>
                          {item.status || "Pending"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="No material requirements"
              description={
                search || status !== "all"
                  ? "No requirements match the selected filters."
                  : "Material requirements generated by MRP will appear here."
              }
              size="default"
            />
          )}
        </section>
      </div>
    </main>
  );
}