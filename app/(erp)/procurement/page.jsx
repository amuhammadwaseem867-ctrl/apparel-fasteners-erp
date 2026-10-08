"use client";

import Link from "next/link";
import {
  ClipboardList,
  FileSearch,
  PackageCheck,
  ShoppingCart,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import ProcurementKpiGrid from "@/components/procurement/ProcurementKpiGrid";
import ProcurementPipeline from "@/components/procurement/ProcurementPipeline";
import ProcurementQuickActions from "@/components/procurement/ProcurementQuickActions";
import ProcurementActivity from "@/components/procurement/ProcurementActivity";
import ProcurementSupplierStatus from "@/components/procurement/ProcurementSupplierStatus";
import ProcurementRequirements from "@/components/procurement/ProcurementRequirements";
import ProcurementWorkflow from "@/components/procurement/ProcurementWorkflow";

import "./ProcurementDashboard.css";

const procurementKpis = [
  {
    id: "requisitions",
    label: "Purchase Requisitions",
    value: 0,
    description: "Open requisitions",
    href: "/procurement/requisitions",
  },
  {
    id: "rfqs",
    label: "Open RFQs",
    value: 0,
    description: "Awaiting supplier quotes",
    href: "/procurement/rfqs",
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    value: 0,
    description: "Active purchase orders",
    href: "/procurement/purchase-orders",
  },
  {
    id: "goods-receipts",
    label: "Pending Receipts",
    value: 0,
    description: "Expected material receipts",
    href: "/procurement/goods-receipts",
  },
  {
    id: "suppliers",
    label: "Active Suppliers",
    value: 0,
    description: "Approved suppliers",
    href: "/procurement/suppliers",
  },
];

const quickActions = [
  {
    id: "supplier",
    label: "Suppliers",
    description: "Manage supplier master",
    href: "/procurement/suppliers",
    icon: Users,
  },
  {
    id: "requisition",
    label: "Purchase Requisition",
    description: "Review material requests",
    href: "/procurement/requisitions",
    icon: ClipboardList,
    tone: "info",
  },
  {
    id: "rfq",
    label: "RFQs",
    description: "Manage quotation requests",
    href: "/procurement/rfqs",
    icon: FileSearch,
  },
  {
    id: "purchase-order",
    label: "Purchase Orders",
    description: "Manage supplier orders",
    href: "/procurement/purchase-orders",
    icon: ShoppingCart,
  },
  {
    id: "goods-receipt",
    label: "Goods Receipts",
    description: "Record incoming materials",
    href: "/procurement/goods-receipts",
    icon: PackageCheck,
  },
];

const procurementModules = [
  {
    title: "Suppliers",
    description:
      "Supplier master, approval, commercial terms and performance.",
    href: "/procurement/suppliers",
    label: "Open Suppliers",
  },
  {
    title: "Purchase Requisitions",
    description:
      "Material requests generated from MRP, inventory or manual demand.",
    href: "/procurement/requisitions",
    label: "Open Requisitions",
  },
  {
    title: "RFQs",
    description:
      "Request and compare supplier quotations before purchasing.",
    href: "/procurement/rfqs",
    label: "Open RFQs",
  },
  {
    title: "Purchase Orders",
    description:
      "Create, approve and monitor supplier purchase orders.",
    href: "/procurement/purchase-orders",
    label: "Open Purchase Orders",
  },
  {
    title: "Goods Receipts",
    description:
      "Receive, inspect and record incoming materials into inventory.",
    href: "/procurement/goods-receipts",
    label: "Open Goods Receipts",
  },
  {
    title: "Supplier Performance",
    description:
      "Monitor delivery, quality, pricing and supplier performance.",
    href: "/procurement/supplier-performance",
    label: "View Performance",
  },
];

export default function ProcurementPage() {
  return (
    <div className="procurement-dashboard">
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Procurement"
        description="Manage material sourcing, supplier purchasing and incoming goods across the apparel business."
      />

      <div className="procurement-dashboard__notice">
        <div className="procurement-dashboard__notice-content">
          <strong>Backend connection pending</strong>

          <p>
            Procurement transactions, supplier records, material
            requirements and purchasing metrics will appear here after
            the API and database are connected.
          </p>
        </div>

        <Badge variant="warning">Not Connected</Badge>
      </div>

      <section className="procurement-dashboard__section">
        <div className="procurement-dashboard__section-heading">
          <div>
            <h2>Procurement Overview</h2>
            <p>
              Current procurement workload and purchasing activity.
            </p>
          </div>
        </div>

        <ProcurementKpiGrid items={procurementKpis} />
      </section>

      <section className="procurement-dashboard__section">
        <ProcurementPipeline />
      </section>

      <section className="procurement-dashboard__two-column">
        <ProcurementRequirements />

        <ProcurementSupplierStatus />
      </section>

      <section className="procurement-dashboard__two-column">
        <ProcurementActivity />

        <ProcurementQuickActions actions={quickActions} />
      </section>

      <section className="procurement-dashboard__section">
        <div className="procurement-dashboard__section-heading">
          <div>
            <h2>Procurement Modules</h2>
            <p>
              Access each area of the procurement workflow.
            </p>
          </div>
        </div>

        <div className="procurement-dashboard__modules">
          {procurementModules.map((module) => (
            <Card
              key={module.href}
              title={module.title}
              description={module.description}
              className="procurement-dashboard__module"
            >
              <Link
                href={module.href}
                className="procurement-dashboard__module-link"
              >
                {module.label}
                <span>→</span>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="procurement-dashboard__section">
        <ProcurementWorkflow />
      </section>
    </div>
  );
}