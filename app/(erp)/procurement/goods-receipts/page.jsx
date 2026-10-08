"use client";

import {
  ClipboardCheck,
  Clock3,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Truck,
  Warehouse,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./GoodsReceipts.css";

const stats = [
  {
    label: "Total Receipts",
    value: "0",
    icon: PackageCheck,
  },
  {
    label: "Pending Inspection",
    value: "0",
    icon: ClipboardCheck,
  },
  {
    label: "Partially Received",
    value: "0",
    icon: Clock3,
  },
  {
    label: "Completed",
    value: "0",
    icon: Warehouse,
  },
];

const lifecycle = [
  {
    number: "01",
    title: "PO Released",
    description: "Released purchase order is ready for receiving.",
  },
  {
    number: "02",
    title: "Material Arrives",
    description: "Supplier shipment reaches the receiving location.",
  },
  {
    number: "03",
    title: "Receipt Created",
    description: "Received quantities are recorded against the PO.",
  },
  {
    number: "04",
    title: "Quality Check",
    description: "Material requiring inspection is sent to QC.",
  },
  {
    number: "05",
    title: "Accepted",
    description: "Accepted quantities become eligible for inventory.",
  },
  {
    number: "06",
    title: "Closed",
    description: "Receipt and purchase order are reconciled.",
  },
];

const receiptFields = [
  "Goods Receipt Number",
  "Purchase Order",
  "Supplier",
  "Shipment Reference",
  "Received Date",
  "Warehouse",
  "Received Quantity",
  "Accepted Quantity",
  "Rejected Quantity",
  "Batch / Lot",
  "Serial Numbers",
  "Inspection Status",
];

const controls = [
  {
    title: "PO Reconciliation",
    description:
      "Every receipt should be linked to a valid purchase order and its relevant line items.",
  },
  {
    title: "Quantity Verification",
    description:
      "Ordered, received, accepted and rejected quantities should remain separately traceable.",
  },
  {
    title: "Quality Handoff",
    description:
      "Materials requiring inspection should move to Quality Control before inventory posting.",
  },
  {
    title: "Warehouse Posting",
    description:
      "Accepted materials should be posted to the correct warehouse and storage location.",
  },
];

export default function GoodsReceiptsPage() {
  return (
    <div className="goods-receipts-page">
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Goods Receipts"
        description="Record incoming supplier deliveries, reconcile purchase orders and route accepted materials into inventory."
      >
        <button
          type="button"
          className="goods-receipts-page__create"
          disabled
        >
          Create Goods Receipt
        </button>
      </PageHeader>

      <div className="goods-receipts-page__notice">
        <div>
          <strong>Goods receipt database not connected</strong>
          <p>
            Receiving transactions will appear here after the procurement
            backend and warehouse inventory system are connected.
          </p>
        </div>

        <Badge variant="warning">Not Connected</Badge>
      </div>

      <section className="goods-receipts-page__stats">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label} className="goods-receipts-page__stat">
              <div className="goods-receipts-page__stat-icon">
                <Icon size={18} strokeWidth={1.8} />
              </div>

              <div className="goods-receipts-page__stat-content">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="goods-receipts-page__toolbar-card">
        <div className="goods-receipts-page__toolbar">
          <div className="goods-receipts-page__search">
            <Search size={16} />

            <Input
              disabled
              placeholder="Search goods receipts..."
              aria-label="Search goods receipts"
            />
          </div>

          <button
            type="button"
            className="goods-receipts-page__filter"
            disabled
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>
      </Card>

      <Card
        title="Goods Receipt Register"
        description="Incoming shipments, received quantities, inspection status and warehouse posting."
        className="goods-receipts-page__register"
      >
        <EmptyState
          icon={PackageCheck}
          title="No goods receipts available"
          description="Goods receipts will appear here when supplier deliveries are recorded against released purchase orders."
        />
      </Card>

      <section className="goods-receipts-page__section">
        <div className="goods-receipts-page__heading">
          <h2>Receiving Lifecycle</h2>
          <p>
            Controlled flow from supplier delivery through inventory
            eligibility.
          </p>
        </div>

        <div className="goods-receipts-page__lifecycle">
          {lifecycle.map((step, index) => (
            <div
              key={step.title}
              className="goods-receipts-page__lifecycle-item"
            >
              <div className="goods-receipts-page__lifecycle-card">
                <span className="goods-receipts-page__step-number">
                  {step.number}
                </span>

                <strong>{step.title}</strong>

                <p>{step.description}</p>
              </div>

              {index < lifecycle.length - 1 && (
                <div className="goods-receipts-page__connector" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="goods-receipts-page__section">
        <div className="goods-receipts-page__heading">
          <h2>Receipt Information</h2>
          <p>
            Core information maintained for every receiving transaction.
          </p>
        </div>

        <Card className="goods-receipts-page__fields-card">
          <div className="goods-receipts-page__fields">
            {receiptFields.map((field, index) => (
              <div key={field} className="goods-receipts-page__field">
                <span>
                  {String(index + 1).padStart(2, "0")}
                </span>

                <strong>{field}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="goods-receipts-page__section">
        <div className="goods-receipts-page__heading">
          <h2>Receiving Controls</h2>
          <p>
            Rules that will be enforced after backend integration.
          </p>
        </div>

        <div className="goods-receipts-page__controls">
          {controls.map((control) => (
            <Card key={control.title} title={control.title}>
              <p>{control.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="goods-receipts-page__flow">
        <div className="goods-receipts-page__flow-icon">
          <Truck size={17} />
        </div>

        <div>
          <strong>Procurement receiving flow</strong>
          <p>
            Purchase Order → Goods Receipt → Quality Control → Inventory
          </p>
        </div>
      </div>
    </div>
  );
}