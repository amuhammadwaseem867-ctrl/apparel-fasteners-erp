"use client";

import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Factory,
  PackageCheck,
  PlayCircle,
  RefreshCw,
  Settings2,
  Timer,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import "./ProductionDashboard.css";

const production = {
  kpis: {},
  workOrders: [],
  schedule: [],
  operations: [],
  issues: [],
  outputs: [],
  activities: [],
};

const WORKFLOW = [
  {
    key: "tape-dyeing",
    label: "Tape Dyeing",
    description: "Fabric dyeing and colour preparation",
    icon: ClipboardList,
  },
  {
    key: "tape-press",
    label: "Tape Press",
    description: "Pressing and dimensional shaping",
    icon: PackageCheck,
  },
  {
    key: "teeth-making",
    label: "Teeth Making",
    description: "Teeth production and forming",
    icon: Factory,
  },
  {
    key: "plating",
    label: "Plating",
    description: "Metal finishing and coating",
    icon: Settings2,
  },
  {
    key: "lacquer-wax",
    label: "Lacquer & Wax",
    description: "Protective finish and wax coating",
    icon: Activity,
  },
  {
    key: "assembling",
    label: "Assembling",
    description: "Component fit and assembly",
    icon: Factory,
  },
  {
    key: "quality-check",
    label: "Quality Check",
    description: "Inspection before packing",
    icon: Settings2,
  },
  {
    key: "packing",
    label: "Packing",
    description: "Unit packing and documentation",
    icon: PackageCheck,
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Order dispatched and received",
    icon: Activity,
  },
];

export default function ProductionPage() {
  return (
    <main className="production-dashboard">
      <PageHeader
        eyebrow="OPERATIONS / PRODUCTION"
        title="Production"
        description="Monitor manufacturing activity, work orders, production schedules, material issues and output across the operation."
        action={
          <Button
            variant="primary"
            size="md"
            icon={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      <div className="production-dashboard__content">
        <section className="production-dashboard__kpis">
          <ProductionKpi
            icon={ClipboardList}
            label="Open Work Orders"
            value={production.kpis.openWorkOrders}
            description="Active production orders"
          />

          <ProductionKpi
            icon={PlayCircle}
            label="In Production"
            value={production.kpis.inProduction}
            description="Orders currently running"
          />

          <ProductionKpi
            icon={Timer}
            label="Scheduled Operations"
            value={production.kpis.scheduledOperations}
            description="Operations planned"
          />

          <ProductionKpi
            icon={AlertTriangle}
            label="Production Issues"
            value={production.kpis.issues}
            description="Exceptions requiring attention"
            danger
          />
        </section>

        <section className="production-dashboard__workflow">
          <div className="production-dashboard__section-heading">
            <div>
              <h2>Production Workflow</h2>
              <p>
                Standard flow from released work order
                through completed production.
              </p>
            </div>
          </div>

          <div className="production-dashboard__workflow-track">
            {WORKFLOW.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  className="production-dashboard__workflow-step"
                  key={step.key}
                >
                  <div className="production-dashboard__workflow-icon">
                    <Icon
                      size={18}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="production-dashboard__workflow-copy">
                    <strong>{step.label}</strong>
                    <span>{step.description}</span>
                  </div>

                  {index < WORKFLOW.length - 1 && (
                    <div className="production-dashboard__workflow-line" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="production-dashboard__grid">
          <Card
            title="Work Orders"
            description="Current production work orders"
            action={
              <Button
                variant="secondary"
                size="small"
              >
                View All
              </Button>
            }
            className="production-dashboard__panel"
          >
            {production.workOrders.length > 0 ? (
              <div>Work orders</div>
            ) : (
              <EmptyState
                size="small"
                icon={ClipboardList}
                title="No work orders"
                description="Released production work orders will appear here."
              />
            )}
          </Card>

          <Card
            title="Production Schedule"
            description="Upcoming production activity"
            action={
              <Button
                variant="secondary"
                size="small"
              >
                Schedule
              </Button>
            }
            className="production-dashboard__panel"
          >
            {production.schedule.length > 0 ? (
              <div>Production schedule</div>
            ) : (
              <EmptyState
                size="small"
                icon={Timer}
                title="No scheduled production"
                description="Planned production operations will appear here."
              />
            )}
          </Card>
        </section>

        <section className="production-dashboard__grid">
          <Card
            title="Operations Monitor"
            description="Current shop-floor operations"
            className="production-dashboard__panel"
          >
            {production.operations.length > 0 ? (
              <div>Operations</div>
            ) : (
              <EmptyState
                size="small"
                icon={Factory}
                title="No active operations"
                description="Production operations will appear here once work orders are released."
              />
            )}
          </Card>

          <Card
            title="Production Issues"
            description="Exceptions affecting production"
            className="production-dashboard__panel"
          >
            {production.issues.length > 0 ? (
              <div>Production issues</div>
            ) : (
              <EmptyState
                size="small"
                icon={AlertTriangle}
                title="No production issues"
                description="Material, capacity and production exceptions will appear here."
              />
            )}
          </Card>
        </section>

        <section className="production-dashboard__grid">
          <Card
            title="Production Output"
            description="Recent completed production"
            className="production-dashboard__panel"
          >
            {production.outputs.length > 0 ? (
              <div>Production output</div>
            ) : (
              <EmptyState
                size="small"
                icon={PackageCheck}
                title="No production output"
                description="Completed production quantities will appear here."
              />
            )}
          </Card>

          <Card
            title="Production Activity"
            description="Recent production events"
            className="production-dashboard__panel"
          >
            {production.activities.length > 0 ? (
              <div>Production activity</div>
            ) : (
              <EmptyState
                size="small"
                icon={Activity}
                title="No recent activity"
                description="Production activity will appear here when operations begin."
              />
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}

function ProductionKpi({
  icon: Icon,
  label,
  value,
  description,
  danger = false,
}) {
  return (
    <div
      className={`production-dashboard__kpi ${
        danger
          ? "production-dashboard__kpi--danger"
          : ""
      }`}
    >
      <div className="production-dashboard__kpi-icon">
        <Icon
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>

      <div className="production-dashboard__kpi-body">
        <span>{label}</span>
        <strong>
          {value ?? "—"}
        </strong>
        <small>{description}</small>
      </div>
    </div>
  );
}