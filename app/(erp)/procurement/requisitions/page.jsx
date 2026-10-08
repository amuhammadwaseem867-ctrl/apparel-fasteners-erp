"use client";

import {
  AlertTriangle,
  ClipboardList,
  Clock3,
  FileCheck2,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./Requisitions.css";

const requisitionStats = [
  {
    label: "Total Requisitions",
    value: 0,
    icon: ClipboardList,
  },
  {
    label: "Pending Review",
    value: 0,
    icon: Clock3,
  },
  {
    label: "Approved",
    value: 0,
    icon: FileCheck2,
  },
  {
    label: "Urgent",
    value: 0,
    icon: AlertTriangle,
  },
];

const requirementSources = [
  {
    title: "MRP Requirement",
    description:
      "Material demand generated from planning and production requirements.",
  },
  {
    title: "Inventory Shortage",
    description:
      "Requirements created when available stock falls below demand or reorder levels.",
  },
  {
    title: "Production Demand",
    description:
      "Materials required to fulfill confirmed production requirements.",
  },
  {
    title: "Manual Request",
    description:
      "Procurement requests created directly by authorized users.",
  },
];

export default function RequisitionsPage() {
  return (
    <div className="requisitions-page">
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Purchase Requisitions"
        description="Capture, review and approve material requirements before supplier sourcing."
      >
        <button
          type="button"
          className="requisitions-page__primary-button"
          disabled
          title="Available after backend integration"
        >
          New Requisition
        </button>
      </PageHeader>

      <div className="requisitions-page__notice">
        <div>
          <strong>Requisition database not connected</strong>
          <p>
            Material requirements from MRP, inventory, production and
            manual requests will populate this module after backend
            integration.
          </p>
        </div>

        <Badge variant="warning">Not Connected</Badge>
      </div>

      <section className="requisitions-page__stats">
        {requisitionStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className="requisitions-page__stat"
            >
              <div className="requisitions-page__stat-icon">
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

      <Card className="requisitions-page__toolbar-card">
        <div className="requisitions-page__toolbar">
          <div className="requisitions-page__search">
            <Search size={16} />

            <Input
              placeholder="Search requisitions..."
              disabled
              aria-label="Search requisitions"
            />
          </div>

          <button
            type="button"
            className="requisitions-page__filter"
            disabled
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>
      </Card>

      <Card
        title="Requisition Register"
        description="Material requests awaiting review, approval or procurement processing."
        className="requisitions-page__register"
      >
        <EmptyState
          icon={ClipboardList}
          title="No purchase requisitions"
          description="Requisitions generated from MRP, inventory shortages, production demand or manual requests will appear here."
        />
      </Card>

      <section className="requisitions-page__section">
        <div className="requisitions-page__section-heading">
          <div>
            <h2>Requirement Sources</h2>
            <p>
              Procurement requirements can originate from multiple ERP
              processes.
            </p>
          </div>
        </div>

        <div className="requisitions-page__source-grid">
          {requirementSources.map((source, index) => (
            <Card
              key={source.title}
              className="requisitions-page__source"
            >
              <div className="requisitions-page__source-number">
                {String(index + 1).padStart(2, "0")}
              </div>

              <h3>{source.title}</h3>

              <p>{source.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="requisitions-page__section">
        <div className="requisitions-page__section-heading">
          <div>
            <h2>Requisition Lifecycle</h2>
            <p>
              Standard control flow before a requirement becomes a
              sourcing request.
            </p>
          </div>
        </div>

        <div className="requisitions-page__lifecycle">
          <div className="requisitions-page__lifecycle-step">
            <span>01</span>
            <strong>Requested</strong>
            <p>Requirement is created.</p>
          </div>

          <div className="requisitions-page__lifecycle-line" />

          <div className="requisitions-page__lifecycle-step">
            <span>02</span>
            <strong>Review</strong>
            <p>Material and quantity are verified.</p>
          </div>

          <div className="requisitions-page__lifecycle-line" />

          <div className="requisitions-page__lifecycle-step">
            <span>03</span>
            <strong>Approved</strong>
            <p>Authorized procurement request.</p>
          </div>

          <div className="requisitions-page__lifecycle-line" />

          <div className="requisitions-page__lifecycle-step">
            <span>04</span>
            <strong>Sourcing</strong>
            <p>Requirement moves to RFQ.</p>
          </div>
        </div>
      </section>
    </div>
  );
}