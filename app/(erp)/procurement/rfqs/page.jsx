"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  Search,
  Send,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./Rfqs.css";

const rfqStats = [
  {
    label: "Total RFQs",
    value: 0,
    icon: FileSearch,
  },
  {
    label: "Draft",
    value: 0,
    icon: Clock3,
  },
  {
    label: "Awaiting Quotes",
    value: 0,
    icon: Send,
  },
  {
    label: "Completed",
    value: 0,
    icon: CheckCircle2,
  },
];

const rfqStatuses = [
  {
    title: "Draft",
    description: "RFQ is being prepared before supplier release.",
  },
  {
    title: "Sent",
    description: "RFQ has been issued to selected suppliers.",
  },
  {
    title: "Awaiting Quotes",
    description: "Supplier responses are pending.",
  },
  {
    title: "Under Evaluation",
    description: "Received quotations are being compared.",
  },
  {
    title: "Awarded",
    description: "Supplier selection has been approved.",
  },
  {
    title: "Closed",
    description: "RFQ process has been completed.",
  },
];

const comparisonCriteria = [
  "Unit Price",
  "Currency",
  "Minimum Order Quantity",
  "Lead Time",
  "Payment Terms",
  "Delivery Terms",
  "Quality / Compliance",
  "Supplier Capacity",
];

export default function RfqsPage() {
  return (
    <div className="rfqs-page">
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Request for Quotations"
        description="Create sourcing requests, collect supplier quotations and evaluate commercial offers."
      >
        <button
          type="button"
          className="rfqs-page__primary-button"
          disabled
          title="Available after backend integration"
        >
          Create RFQ
        </button>
      </PageHeader>

      <div className="rfqs-page__notice">
        <div>
          <strong>RFQ database not connected</strong>
          <p>
            RFQs, supplier responses and quotation comparisons will be
            loaded from the backend after procurement APIs are connected.
          </p>
        </div>

        <Badge variant="warning">Not Connected</Badge>
      </div>

      <section className="rfqs-page__stats">
        {rfqStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label} className="rfqs-page__stat">
              <div className="rfqs-page__stat-icon">
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

      <Card className="rfqs-page__toolbar-card">
        <div className="rfqs-page__toolbar">
          <div className="rfqs-page__search">
            <Search size={16} />

            <Input
              placeholder="Search RFQs..."
              disabled
              aria-label="Search RFQs"
            />
          </div>

          <button
            type="button"
            className="rfqs-page__filter"
            disabled
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>
      </Card>

      <Card
        title="RFQ Register"
        description="Sourcing requests and supplier quotation responses."
        className="rfqs-page__register"
      >
        <EmptyState
          icon={FileSearch}
          title="No RFQs available"
          description="RFQs created from approved purchase requisitions will appear here once the procurement backend is connected."
        />
      </Card>

      <section className="rfqs-page__section">
        <div className="rfqs-page__section-heading">
          <div>
            <h2>RFQ Lifecycle</h2>
            <p>
              Standard workflow for sourcing material from approved suppliers.
            </p>
          </div>
        </div>

        <div className="rfqs-page__lifecycle">
          {rfqStatuses.map((status, index) => (
            <div
              key={status.title}
              className="rfqs-page__lifecycle-wrapper"
            >
              <div className="rfqs-page__lifecycle-step">
                <span className="rfqs-page__lifecycle-number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <strong>{status.title}</strong>

                <p>{status.description}</p>
              </div>

              {index < rfqStatuses.length - 1 && (
                <ArrowRight
                  className="rfqs-page__lifecycle-arrow"
                  size={15}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rfqs-page__section">
        <div className="rfqs-page__section-heading">
          <div>
            <h2>Quotation Comparison</h2>
            <p>
              Supplier offers should be evaluated using commercial,
              delivery and quality criteria.
            </p>
          </div>
        </div>

        <Card className="rfqs-page__comparison-card">
          <div className="rfqs-page__comparison-header">
            <div>
              <strong>Supplier Comparison Matrix</strong>
              <p>
                Comparison data will be populated from supplier quotation
                responses.
              </p>
            </div>

            <Badge variant="neutral">No Data</Badge>
          </div>

          <div className="rfqs-page__criteria">
            {comparisonCriteria.map((criterion) => (
              <div
                key={criterion}
                className="rfqs-page__criterion"
              >
                <CheckCircle2 size={15} />
                <span>{criterion}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="rfqs-page__section">
        <div className="rfqs-page__section-heading">
          <div>
            <h2>RFQ Controls</h2>
            <p>
              Procurement rules that will be enforced by the backend.
            </p>
          </div>
        </div>

        <div className="rfqs-page__controls">
          <Card title="Supplier Selection">
            <p>
              Only approved and eligible suppliers should receive RFQs
              for relevant product divisions and material categories.
            </p>
          </Card>

          <Card title="Commercial Evaluation">
            <p>
              Pricing, currency, MOQ, payment terms and delivery terms
              should be captured for comparison.
            </p>
          </Card>

          <Card title="Approval">
            <p>
              Supplier selection should follow configured purchasing
              authority and approval thresholds.
            </p>
          </Card>

          <Card title="Conversion">
            <p>
              An awarded RFQ can progress into an approved purchase
              order without losing sourcing history.
            </p>
          </Card>
        </div>
      </section>

      <div className="rfqs-page__warning">
        <XCircle size={17} />

        <p>
          Supplier selection, quotation comparison and RFQ-to-PO
          conversion will be controlled by backend business rules.
        </p>
      </div>
    </div>
  );
}