"use client";

import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./SupplierPerformance.css";

const performanceStats = [
  {
    label: "Suppliers Evaluated",
    value: 0,
    icon: BarChart3,
  },
  {
    label: "On-Time Delivery",
    value: "0%",
    icon: Truck,
  },
  {
    label: "Quality Acceptance",
    value: "0%",
    icon: PackageCheck,
  },
  {
    label: "Active Evaluations",
    value: 0,
    icon: Clock3,
  },
];

const scoreDimensions = [
  {
    number: "01",
    title: "Delivery Performance",
    description:
      "Measures supplier adherence to confirmed delivery dates and lead times.",
    icon: Truck,
  },
  {
    number: "02",
    title: "Quality Performance",
    description:
      "Tracks accepted, rejected and non-conforming quantities received from suppliers.",
    icon: CheckCircle2,
  },
  {
    number: "03",
    title: "Commercial Performance",
    description:
      "Evaluates pricing, payment terms, quotation accuracy and commercial compliance.",
    icon: BarChart3,
  },
  {
    number: "04",
    title: "Compliance",
    description:
      "Monitors required certifications, documents, approvals and supplier compliance.",
    icon: ShieldCheck,
  },
];

const ratingLevels = [
  {
    label: "Excellent",
    description: "Consistently meets or exceeds approved supplier requirements.",
  },
  {
    label: "Good",
    description: "Generally meets requirements with limited exceptions.",
  },
  {
    label: "Needs Improvement",
    description: "Performance requires monitoring and corrective action.",
  },
  {
    label: "Critical",
    description: "Repeated performance issues require formal supplier review.",
  },
];

const evaluationControls = [
  {
    title: "Evaluation Period",
    description:
      "Supplier performance should be measured over configurable periods such as monthly, quarterly or annually.",
  },
  {
    title: "Weighted Scoring",
    description:
      "Delivery, quality, commercial and compliance criteria can use configurable weights.",
  },
  {
    title: "Corrective Actions",
    description:
      "Poor performance should create follow-up actions, review records and improvement plans.",
  },
  {
    title: "Supplier Status",
    description:
      "Evaluation results may influence approved, conditional, inactive or blocked supplier status.",
  },
];

export default function SupplierPerformancePage() {
  return (
    <div className="supplier-performance-page">
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Supplier Performance"
        description="Monitor supplier delivery, quality, commercial and compliance performance across the procurement lifecycle."
      >
        <button
          type="button"
          className="supplier-performance-page__primary-button"
          disabled
          title="Available after backend integration"
        >
          Start Evaluation
        </button>
      </PageHeader>

      <div className="supplier-performance-page__notice">
        <div>
          <strong>Supplier performance data not connected</strong>
          <p>
            Performance scores will be calculated from supplier, purchase
            order, goods receipt and quality records after backend integration.
          </p>
        </div>

        <Badge variant="warning">Not Connected</Badge>
      </div>

      <section className="supplier-performance-page__stats">
        {performanceStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className="supplier-performance-page__stat"
            >
              <div className="supplier-performance-page__stat-icon">
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

      <Card className="supplier-performance-page__toolbar-card">
        <div className="supplier-performance-page__toolbar">
          <div className="supplier-performance-page__search">
            <Search size={16} />

            <Input
              placeholder="Search supplier performance..."
              disabled
              aria-label="Search supplier performance"
            />
          </div>

          <button
            type="button"
            className="supplier-performance-page__filter"
            disabled
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>
      </Card>

      <Card
        title="Supplier Performance Register"
        description="Supplier scorecards, evaluation periods, performance trends and corrective actions."
        className="supplier-performance-page__register"
      >
        <EmptyState
          icon={BarChart3}
          title="No supplier performance records"
          description="Supplier scorecards will appear here after supplier, purchase order, receiving and quality data are connected."
        />
      </Card>

      <section className="supplier-performance-page__section">
        <div className="supplier-performance-page__section-heading">
          <div>
            <h2>Performance Dimensions</h2>
            <p>
              Core criteria used to evaluate procurement supplier performance.
            </p>
          </div>
        </div>

        <div className="supplier-performance-page__dimensions">
          {scoreDimensions.map((dimension) => {
            const Icon = dimension.icon;

            return (
              <Card
                key={dimension.title}
                className="supplier-performance-page__dimension"
              >
                <div className="supplier-performance-page__dimension-top">
                  <span>{dimension.number}</span>

                  <div className="supplier-performance-page__dimension-icon">
                    <Icon size={17} />
                  </div>
                </div>

                <h3>{dimension.title}</h3>

                <p>{dimension.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="supplier-performance-page__section">
        <div className="supplier-performance-page__section-heading">
          <div>
            <h2>Supplier Rating Framework</h2>
            <p>
              Configurable performance levels for supplier evaluation.
            </p>
          </div>
        </div>

        <Card className="supplier-performance-page__rating-card">
          <div className="supplier-performance-page__rating-grid">
            {ratingLevels.map((rating, index) => (
              <div
                key={rating.label}
                className="supplier-performance-page__rating"
              >
                <div className="supplier-performance-page__rating-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div>
                  <strong>{rating.label}</strong>
                  <p>{rating.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="supplier-performance-page__section">
        <div className="supplier-performance-page__section-heading">
          <div>
            <h2>Evaluation Controls</h2>
            <p>
              Business rules that will be applied by the procurement backend.
            </p>
          </div>
        </div>

        <div className="supplier-performance-page__controls">
          {evaluationControls.map((control) => (
            <Card key={control.title} title={control.title}>
              <p>{control.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="supplier-performance-page__formula">
        <div className="supplier-performance-page__formula-icon">
          <Award size={18} />
        </div>

        <div>
          <strong>Supplier scorecard</strong>

          <p>
            Delivery + Quality + Commercial + Compliance → Weighted Supplier
            Performance Score
          </p>
        </div>
      </div>

      <div className="supplier-performance-page__warning">
        <XCircle size={17} />

        <p>
          Supplier performance should not automatically block purchasing
          activity without configured approval rules and authorized review.
        </p>
      </div>
    </div>
  );
}