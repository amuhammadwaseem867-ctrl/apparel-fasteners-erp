"use client";

import {
  CheckCircle2,
  Clock3,
  FileText,
  Package,
  Search,
  Send,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./PurchaseOrders.css";

const purchaseOrderStats = [
  {
    label: "Total Purchase Orders",
    value: 0,
    icon: ShoppingCart,
  },
  {
    label: "Pending Approval",
    value: 0,
    icon: Clock3,
  },
  {
    label: "Approved",
    value: 0,
    icon: CheckCircle2,
  },
  {
    label: "Open Orders",
    value: 0,
    icon: Package,
  },
];

const orderStatuses = [
  {
    number: "01",
    title: "Draft",
    description: "PO is being prepared.",
  },
  {
    number: "02",
    title: "Pending Approval",
    description: "PO is awaiting authorization.",
  },
  {
    number: "03",
    title: "Approved",
    description: "PO has been approved for release.",
  },
  {
    number: "04",
    title: "Sent",
    description: "Purchase order has been issued to supplier.",
  },
  {
    number: "05",
    title: "Partially Received",
    description: "Some ordered materials have been received.",
  },
  {
    number: "06",
    title: "Completed",
    description: "Order has been fully received and closed.",
  },
];

const poStructure = [
  {
    title: "Supplier",
    description:
      "Approved supplier, contact information and commercial relationship.",
  },
  {
    title: "Order Lines",
    description:
      "Products, SKUs, quantities, units, prices and applicable taxes.",
  },
  {
    title: "Commercial Terms",
    description:
      "Currency, payment terms, discounts, taxes and total order value.",
  },
  {
    title: "Delivery",
    description:
      "Expected delivery date, warehouse, shipping and delivery instructions.",
  },
];

export default function PurchaseOrdersPage() {
  return (
    <div className="purchase-orders-page">
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Purchase Orders"
        description="Create, approve and monitor supplier purchase orders across garments, fabrics and garment accessories."
      >
        <button
          type="button"
          className="purchase-orders-page__primary-button"
          disabled
          title="Available after backend integration"
        >
          Create Purchase Order
        </button>
      </PageHeader>

      <div className="purchase-orders-page__notice">
        <div>
          <strong>Purchase order database not connected</strong>
          <p>
            Purchase orders will be generated from approved procurement
            requirements and supplier quotations after backend integration.
          </p>
        </div>

        <Badge variant="warning">Not Connected</Badge>
      </div>

      <section className="purchase-orders-page__stats">
        {purchaseOrderStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className="purchase-orders-page__stat"
            >
              <div className="purchase-orders-page__stat-icon">
                <Icon size={18} strokeWidth={1.8} />
              </div>

              <div>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="purchase-orders-page__toolbar-card">
        <div className="purchase-orders-page__toolbar">
          <div className="purchase-orders-page__search">
            <Search size={16} />

            <Input
              placeholder="Search purchase orders..."
              disabled
              aria-label="Search purchase orders"
            />
          </div>

          <button
            type="button"
            className="purchase-orders-page__filter"
            disabled
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>
      </Card>

      <Card
        title="Purchase Order Register"
        description="Supplier orders, approval status, delivery progress and receiving status."
        className="purchase-orders-page__register"
      >
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders available"
          description="Approved sourcing requirements and awarded supplier quotations will generate purchase orders after backend integration."
        />
      </Card>

      <section className="purchase-orders-page__section">
        <div className="purchase-orders-page__section-heading">
          <div>
            <h2>Purchase Order Lifecycle</h2>
            <p>
              Controlled process from PO preparation through material receipt.
            </p>
          </div>
        </div>

        <div className="purchase-orders-page__lifecycle">
          {orderStatuses.map((status, index) => (
            <div
              key={status.title}
              className="purchase-orders-page__lifecycle-wrapper"
            >
              <div className="purchase-orders-page__lifecycle-step">
                <span>
                  {status.number}
                </span>

                <strong>{status.title}</strong>

                <p>{status.description}</p>
              </div>

              {index < orderStatuses.length - 1 && (
                <div className="purchase-orders-page__lifecycle-line" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="purchase-orders-page__section">
        <div className="purchase-orders-page__section-heading">
          <div>
            <h2>Purchase Order Structure</h2>
            <p>
              Core information maintained on every purchase order.
            </p>
          </div>
        </div>

        <div className="purchase-orders-page__structure-grid">
          {poStructure.map((item, index) => (
            <Card
              key={item.title}
              className="purchase-orders-page__structure-card"
            >
              <div className="purchase-orders-page__structure-number">
                {String(index + 1).padStart(2, "0")}
              </div>

              <h3>{item.title}</h3>

              <p>{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="purchase-orders-page__section">
        <div className="purchase-orders-page__section-heading">
          <div>
            <h2>PO Controls</h2>
            <p>
              Business rules that will be enforced by the procurement backend.
            </p>
          </div>
        </div>

        <div className="purchase-orders-page__controls">
          <Card title="Source Validation">
            <p>
              PO creation should reference an approved requisition or
              awarded supplier quotation where required.
            </p>
          </Card>

          <Card title="Approval">
            <p>
              Purchasing authority and approval thresholds should be
              applied before supplier release.
            </p>
          </Card>

          <Card title="Commercial Lock">
            <p>
              Approved quantities, prices, currency, taxes and payment
              terms should be controlled after authorization.
            </p>
          </Card>

          <Card title="Receiving">
            <p>
              Partial and complete receipts should update PO fulfillment
              without losing the original order history.
            </p>
          </Card>
        </div>
      </section>

      <div className="purchase-orders-page__info">
        <FileText size={17} />

        <p>
          Purchase orders can contain mixed material lines across
          Garments, Fabrics and Garment Accessories where the procurement
          process permits.
        </p>
      </div>

      <div className="purchase-orders-page__release">
        <Send size={16} />

        <p>
          Supplier release and PO communication will be enabled once the
          backend, approval workflow and supplier integration are connected.
        </p>
      </div>
    </div>
  );
}