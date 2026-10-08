"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

import {
  RefreshCw,
  CalendarDays,
} from "lucide-react";

import PlanningKpiGrid from "@/components/planning/PlanningKpiGrid";
import PlanningQuickActions from "@/components/planning/PlanningQuickActions";
import PlanningWorkflow from "@/components/planning/PlanningWorkflow";
import PlanningDemandSummary from "@/components/planning/PlanningDemandSummary";
import PlanningRequirements from "@/components/planning/PlanningRequirements";
import PlanningShortages from "@/components/planning/PlanningShortages";
import PlanningProductionPlans from "@/components/planning/PlanningProductionPlans";
import PlanningActivity from "@/components/planning/PlanningActivity";

import "./PlanningDashboard.css";

export default function PlanningPage() {
  const router = useRouter();

  /*
   * Backend integration point.
   *
   * Later this object will be populated from:
   * - Sales Orders
   * - BOM
   * - Inventory
   * - MRP Engine
   * - Production Planning
   * - Material Reservations
   *
   * No mock records are intentionally used here.
   */
  const planning = useMemo(
    () => ({
      kpis: {},
      demands: [],
      requirements: [],
      shortages: [],
      productionPlans: [],
      activities: [],
    }),
    []
  );

  const handleRefresh = () => {
    /*
     * API refresh will be implemented here.
     */
  };

  return (
    <main className="planning-dashboard">
      <PageHeader
        eyebrow="PLANNING & MRP"
        title="Planning Overview"
        description="Plan material requirements, identify shortages, and coordinate production demand."
        action={
          <div className="planning-dashboard__header-actions">
            <Button
              variant="secondary"
              size="md"
              icon={CalendarDays}
              onClick={() => router.push("/planning/calendar")}
            >
              Planning Calendar
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

      <div className="planning-dashboard__content">
        <PlanningKpiGrid
          data={planning.kpis}
        />

        <PlanningQuickActions />

        <PlanningWorkflow />

        <div className="planning-dashboard__primary-grid">
          <PlanningDemandSummary
            demands={planning.demands}
          />

          <PlanningShortages
            shortages={planning.shortages}
          />
        </div>

        <PlanningRequirements
          requirements={planning.requirements}
        />

        <PlanningProductionPlans
          plans={planning.productionPlans}
        />

        <PlanningActivity
          activities={planning.activities}
        />
      </div>
    </main>
  );
}