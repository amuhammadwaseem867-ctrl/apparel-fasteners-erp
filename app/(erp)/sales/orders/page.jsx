 "use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";

import useOrderStore from "@/lib/useOrderStore";
import useOrderFilters from "@/lib/useOrderFilters";

import {
  ORDER_STATUSES,
  ZIPPER_SIZES,
  MATERIALS,
  LOGO_TYPES,
  PRODUCTION_PRIORITIES,
} from "@/config/orders";
import { PRODUCTION_STAGES } from "@/config/production";

import "./Orders.css";

const PAGE_SIZE = 25;

export default function OrdersPage() {
  const toast = useToast();

  const {
    orders,
    deleteOrder,
    setStatus,
  } = useOrderStore([]);

  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    customer: "",
    stage: "all",
    priority: "all",
    product: "",
    size: "all",
    material: "all",
    finish: "",
    logo: "all",
    dateFrom: "",
    dateTo: "",
  });

  const [showFilters, setShowFilters] = useState(false);

  const [sort, setSort] = useState({
    key: "updatedAt",
    direction: "desc",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusNext, setStatusNext] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (filters.search) count += 1;
    if (filters.status !== "all") count += 1;
    if (filters.customer) count += 1;
    if (filters.stage !== "all") count += 1;
    if (filters.priority !== "all") count += 1;
    if (filters.product) count += 1;
    if (filters.size !== "all") count += 1;
    if (filters.material !== "all") count += 1;
    if (filters.finish) count += 1;
    if (filters.logo !== "all") count += 1;
    if (filters.dateFrom) count += 1;
    if (filters.dateTo) count += 1;

    return count;
  }, [filters]);

  const {
    rows,
    total,
    page,
    pageSize,
    totalPages,
  } = useOrderFilters(orders, filters, sort, pagination);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      ORDER_STATUSES.map((status) => [status.id, 0])
    );

    orders.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });

    return counts;
  }, [orders]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPagination((current) => ({ ...current, page: 1 }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      status: "all",
      customer: "",
      stage: "all",
      priority: "all",
      product: "",
      size: "all",
      material: "all",
      finish: "",
      logo: "all",
      dateFrom: "",
      dateTo: "",
    });

    setPagination((current) => ({ ...current, page: 1 }));
  }

  function handleSort(key) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc"
          ? "desc"
          : "asc",
    }));
  }

  function handleDelete() {
    if (!deleteTarget) return;

    setSubmitting(true);

    deleteOrder(deleteTarget.id);

    setSubmitting(false);
    setDeleteTarget(null);

    toast.success({
      title: "Order deleted",
      message: `${deleteTarget.orderNumber} was removed.`,
    });
  }

  function handleStatusChange() {
    if (!statusTarget || !statusNext) return;

    setSubmitting(true);

    setStatus(statusTarget.id, statusNext, statusRemarks);

    setSubmitting(false);
    setStatusTarget(null);
    setStatusNext("");
    setStatusRemarks("");

    toast.success({
      title: "Status updated",
      message: `${statusTarget.orderNumber} updated.`,
    });
  }

  const stageLabel = (key) =>
    PRODUCTION_STAGES.find((stage) => stage.key === key)?.label || "—";

  const priorityVariant = {
    low: "default",
    normal: "info",
    high: "warning",
    urgent: "danger",
  };

  return (
    <main className="sales-orders">
      <PageHeader
        eyebrow="Business / Sales & CRM"
        title="Orders"
        description="Customer orders are the backbone of the ERP. Create, filter, track and trace every zipper order."
        action={
          <Link href="/sales/orders/new">
            <Button variant="primary" icon={Plus}>
              New Order
            </Button>
          </Link>
        }
      />

      <div className="sales-orders__content">
        {/* STATUS OVERVIEW — clickable filters */}
        <section className="sales-orders__status-card">
          <div className="sales-orders__status-grid sales-orders__status-grid--wide">
            {ORDER_STATUSES.map((status) => (
              <button
                className={`sales-orders__status sales-orders__status--${status.id}${
                  filters.status === status.id
                    ? " sales-orders__status--selected"
                    : ""
                }`}
                key={status.id}
                type="button"
                onClick={() =>
                  updateFilter(
                    "status",
                    filters.status === status.id ? "all" : status.id
                  )
                }
              >
                <div className="sales-orders__status-content">
                  <strong>{status.label}</strong>
                </div>

                <b>{statusCounts[status.id] ?? 0}</b>
              </button>
            ))}
          </div>
        </section>

        {/* TOOLBAR */}
        <section className="sales-orders__toolbar">
          <div className="sales-orders__search">
            <Input
              placeholder="Search order number, customer, code, SKU, stage..."
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </div>

          <div className="sales-orders__filters">
            <Button
              variant={activeFilterCount > 0 ? "soft" : "secondary"}
              onClick={() => setShowFilters((current) => !current)}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="sales-orders__filter-count">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {activeFilterCount > 0 && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </section>

        {/* FILTER PANEL */}
        {showFilters && (
          <section className="sales-orders__filter-panel">
            <div className="sales-orders__filter-grid">
              <Select
                label="Status"
                value={filters.status}
                onChange={(value) => updateFilter("status", value)}
                options={[
                  { value: "all", label: "All Statuses" },
                  ...ORDER_STATUSES.map((status) => ({
                    value: status.id,
                    label: status.label,
                  })),
                ]}
              />

              <Input
                label="Customer"
                placeholder="Filter by customer name"
                value={filters.customer}
                onChange={(event) =>
                  updateFilter("customer", event.target.value)
                }
              />

              <Select
                label="Production Stage"
                value={filters.stage}
                onChange={(value) => updateFilter("stage", value)}
                options={[
                  { value: "all", label: "All Stages" },
                  ...PRODUCTION_STAGES.map((stage) => ({
                    value: stage.key,
                    label: stage.label,
                  })),
                ]}
              />

              <Select
                label="Priority"
                value={filters.priority}
                onChange={(value) => updateFilter("priority", value)}
                options={[
                  { value: "all", label: "All Priorities" },
                  ...PRODUCTION_PRIORITIES.map((priority) => ({
                    value: priority.id,
                    label: priority.label,
                  })),
                ]}
              />

              <Input
                label="Product / Zipper Type"
                placeholder="e.g. Metal Zipper"
                value={filters.product}
                onChange={(event) =>
                  updateFilter("product", event.target.value)
                }
              />

              <Select
                label="Size"
                value={filters.size}
                onChange={(value) => updateFilter("size", value)}
                options={[
                  { value: "all", label: "All Sizes" },
                  ...ZIPPER_SIZES.map((size) => ({
                    value: size,
                    label: size,
                  })),
                ]}
              />

              <Select
                label="Material"
                value={filters.material}
                onChange={(value) => updateFilter("material", value)}
                options={[
                  { value: "all", label: "All Materials" },
                  ...MATERIALS.map((material) => ({
                    value: material,
                    label: material,
                  })),
                ]}
              />

              <Input
                label="Color / Finish"
                placeholder="e.g. Antique Silver"
                value={filters.finish}
                onChange={(event) =>
                  updateFilter("finish", event.target.value)
                }
              />

              <Select
                label="Logo / Plain"
                value={filters.logo}
                onChange={(value) => updateFilter("logo", value)}
                options={[
                  { value: "all", label: "All" },
                  ...LOGO_TYPES.map((logo) => ({
                    value: logo.id,
                    label: logo.label,
                  })),
                ]}
              />

              <Input
                label="Order Date From"
                type="date"
                value={filters.dateFrom}
                onChange={(event) =>
                  updateFilter("dateFrom", event.target.value)
                }
              />

              <Input
                label="Order Date To"
                type="date"
                value={filters.dateTo}
                onChange={(event) =>
                  updateFilter("dateTo", event.target.value)
                }
              />
            </div>
          </section>
        )}

        {/* TABLE */}
        <section className="sales-orders__table-card">
          {total === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={
                activeFilterCount > 0 ? "No matching orders" : "No orders yet"
              }
              description={
                activeFilterCount > 0
                  ? "No orders match the current search and filters. Clear filters to see all orders."
                  : "Create the first customer order. Orders drive planning, production, QC, packing and delivery."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Link href="/sales/orders/new">
                    <Button variant="primary" icon={Plus}>
                      New Order
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <div className="sales-orders__table-wrap">
              <table className="sales-orders__table">
                <thead>
                  <tr>
                    <th
                      className="sales-orders__th-sortable"
                      onClick={() => handleSort("orderNumber")}
                    >
                      Order Number{" "}
                      {sort.key === "orderNumber" &&
                        (sort.direction === "asc" ? "↑" : "↓")}
                    </th>

                    <th>Customer</th>

                    <th>Product</th>

                    <th
                      className="sales-orders__th-sortable"
                      onClick={() => handleSort("requiredQuantity")}
                    >
                      Quantity{" "}
                      {sort.key === "requiredQuantity" &&
                        (sort.direction === "asc" ? "↑" : "↓")}
                    </th>

                    <th>Current Stage</th>

                    <th>Status</th>

                    <th
                      className="sales-orders__th-sortable"
                      onClick={() => handleSort("requiredDeliveryDate")}
                    >
                      Required Delivery{" "}
                      {sort.key === "requiredDeliveryDate" &&
                        (sort.direction === "asc" ? "↑" : "↓")}
                    </th>

                    <th>Priority</th>

                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/sales/orders/${order.id}`}
                          className="sales-orders__order-link"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>

                      <td>
                        <div className="sales-orders__cell-main">
                          {order.customerName || "—"}
                        </div>

                        <div className="sales-orders__cell-sub">
                          {order.customerCode}
                        </div>
                      </td>

                      <td>
                        <div className="sales-orders__cell-main">
                          {order.zipperType || "—"}
                        </div>

                        <div className="sales-orders__cell-sub">
                          {[
                            order.zipperSize,
                            order.material,
                            order.colorFinish,
                            order.logoType === "logo" ? "Logo" : "Plain",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </td>

                      <td>
                        {order.requiredQuantity.toLocaleString()}{" "}
                        {order.unit}
                      </td>

                      <td>{stageLabel(order.currentStage)}</td>

                      <td>
                        <Badge
                          variant={
                            order.status === "delivered"
                              ? "success"
                              : order.status === "cancelled"
                                ? "danger"
                                : order.status === "on-hold" ||
                                    order.status === "qc-pending"
                                  ? "warning"
                                  : "info"
                          }
                        >
                          {ORDER_STATUSES.find((s) => s.id === order.status)
                            ?.label || order.status}
                        </Badge>
                      </td>

                      <td>{order.requiredDeliveryDate || "—"}</td>

                      <td>
                        <Badge
                          variant={priorityVariant[order.productionPriority]}
                        >
                          {PRODUCTION_PRIORITIES.find(
                            (priority) =>
                              priority.id === order.productionPriority
                          )?.label || order.productionPriority}
                        </Badge>
                      </td>

                      <td>
                        <div className="sales-orders__row-actions">
                          <Link href={`/sales/orders/${order.id}`}>
                            <Button
                              variant="secondary"
                              size="icon"
                              icon={Eye}
                              ariaLabel="View order"
                            />
                          </Link>

                          <Link href={`/sales/orders/${order.id}/edit`}>
                            <Button
                              variant="secondary"
                              size="icon"
                              icon={Pencil}
                              ariaLabel="Edit order"
                            />
                          </Link>

                          <Button
                            variant="secondary"
                            size="icon"
                            icon={Trash2}
                            ariaLabel="Delete order"
                            onClick={() => setDeleteTarget(order)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {total > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) =>
              setPagination((current) => ({ ...current, page: nextPage }))
            }
            onPageSizeChange={(nextSize) =>
              setPagination({ page: 1, pageSize: nextSize })
            }
          />
        )}
      </div>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete order?"
        description={`This will permanently remove ${
          deleteTarget?.orderNumber || ""
        } from the current ERP state.`}
        confirmLabel="Delete"
        variant="danger"
        loading={submitting}
      />

      {/* STATUS CHANGE */}
      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title="Change Order Status"
        description={statusTarget?.orderNumber}
      >
        <div className="sales-orders__status-form">
          <Select
            label="New Status"
            value={statusNext}
            onChange={setStatusNext}
            options={ORDER_STATUSES.map((status) => ({
              value: status.id,
              label: status.label,
            }))}
          />

          <Input
            label="Remarks"
            placeholder="Optional remarks for the status change"
            value={statusRemarks}
            onChange={(event) => setStatusRemarks(event.target.value)}
          />

          <div className="sales-orders__status-form-actions">
            <Button
              variant="secondary"
              onClick={() => setStatusTarget(null)}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!statusNext || submitting}
              onClick={handleStatusChange}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
