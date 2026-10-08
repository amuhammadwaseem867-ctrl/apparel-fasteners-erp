"use client";

import {
  Building2,
  CheckCircle2,
  Clock3,
  Search,
  SlidersHorizontal,
  Users,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./Suppliers.css";

const supplierStats = [
  {
    label: "Total Suppliers",
    value: 0,
    icon: Users,
  },
  {
    label: "Approved",
    value: 0,
    icon: CheckCircle2,
  },
  {
    label: "Pending Approval",
    value: 0,
    icon: Clock3,
  },
  {
    label: "Inactive",
    value: 0,
    icon: XCircle,
  },
];

const supplierCategories = [
  "Garments",
  "Fabrics",
  "Garment Accessories",
  "Packaging",
  "Services",
  "Other",
];

export default function SuppliersPage() {
  return (
    <div className="suppliers-page">
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Suppliers"
        description="Manage supplier master records, approvals, commercial terms and procurement relationships."
      >
        <button
          type="button"
          className="suppliers-page__primary-button"
          disabled
          title="Available after backend integration"
        >
          Add Supplier
        </button>
      </PageHeader>

      <div className="suppliers-page__notice">
        <div>
          <strong>Supplier database not connected</strong>
          <p>
            Supplier records will be loaded from the backend once the
            database and supplier APIs are connected.
          </p>
        </div>

        <Badge variant="warning">Not Connected</Badge>
      </div>

      <section className="suppliers-page__stats">
        {supplierStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className="suppliers-page__stat"
            >
              <div className="suppliers-page__stat-icon">
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

      <Card className="suppliers-page__toolbar-card">
        <div className="suppliers-page__toolbar">
          <div className="suppliers-page__search">
            <Search size={16} />

            <Input
              placeholder="Search suppliers..."
              disabled
              aria-label="Search suppliers"
            />
          </div>

          <button
            type="button"
            className="suppliers-page__filter"
            disabled
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>
      </Card>

      <Card
        title="Supplier Directory"
        description="Approved and registered suppliers across the procurement network."
        className="suppliers-page__directory"
      >
        <EmptyState
          icon={Building2}
          title="No suppliers available"
          description="Supplier records will appear here after the supplier master database is connected."
        />
      </Card>

      <section className="suppliers-page__structure">
        <div className="suppliers-page__section-heading">
          <div>
            <h2>Supplier Master Structure</h2>
            <p>
              Core information that will be maintained for every supplier.
            </p>
          </div>
        </div>

        <div className="suppliers-page__structure-grid">
          <Card title="Company Information">
            <ul>
              <li>Supplier / Company Name</li>
              <li>Supplier Code</li>
              <li>Registration Details</li>
              <li>Supplier Category</li>
              <li>Primary Contact</li>
            </ul>
          </Card>

          <Card title="Commercial">
            <ul>
              <li>Currency</li>
              <li>Payment Terms</li>
              <li>Credit Terms</li>
              <li>Price Lists</li>
              <li>Tax Information</li>
            </ul>
          </Card>

          <Card title="Supply Capability">
            <ul>
              <li>Product Division</li>
              <li>Material Categories</li>
              <li>Minimum Order Quantity</li>
              <li>Lead Time</li>
              <li>Supply Capacity</li>
            </ul>
          </Card>

          <Card title="Compliance & Performance">
            <ul>
              <li>Certifications</li>
              <li>Quality Requirements</li>
              <li>Delivery Performance</li>
              <li>Quality Performance</li>
              <li>Supplier Status</li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="suppliers-page__categories">
        <div className="suppliers-page__section-heading">
          <div>
            <h2>Supplier Categories</h2>
            <p>
              Classification used to organize the procurement network.
            </p>
          </div>
        </div>

        <div className="suppliers-page__category-list">
          {supplierCategories.map((category) => (
            <div
              key={category}
              className="suppliers-page__category"
            >
              <span>{category}</span>
              <strong>0</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}