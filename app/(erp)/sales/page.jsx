"use client";

import {
  ClipboardList,
  ShoppingCart,
  UserRound,
  Users,
} from "lucide-react";

import Link from "next/link";

import PageHeader from "@/components/ui/PageHeader";

import SalesKpiGrid from "@/components/sales/SalesKpiGrid";
import SalesPipeline from "@/components/sales/SalesPipeline";
import SalesActivity from "@/components/sales/SalesActivity";
import SalesFollowUps from "@/components/sales/SalesFollowUps";
import SalesQuickActions from "@/components/sales/SalesQuickActions";

import "./SalesDashboard.css";

export default function SalesDashboardPage() {
  /*
   * Backend-ready structure.
   *
   * These arrays intentionally remain empty until
   * the Sales API / database layer is connected.
   */
  const salesKpis = [];

  const pipelineStages = [];

  const recentActivities = [];

  const followUps = [];

  const quickActions = [
    {
      id: "new-order",
      label: "New Sales Order",
      description: "Create confirmed order",
      icon: ShoppingCart,
      href: "/sales/orders/new",
      tone: "success",
    },
    {
      id: "new-customer",
      label: "New Customer",
      description: "Add customer account",
      icon: UserRound,
      href: "/sales/customers",
    },
  ];

  return (
    <main className="sales-dashboard">
      <PageHeader
        eyebrow="Sales & CRM"
        title="Sales Dashboard"
        description="Monitor customer activity, sales pipeline, quotations and orders."
      />

      <div className="sales-dashboard__content">
        {/* =========================================
            KPI OVERVIEW
        ========================================= */}

        <section className="sales-dashboard__section">
          <div className="sales-dashboard__section-heading">
            <div>
              <h2>Sales Overview</h2>

              <p>
                Key sales performance indicators from the
                connected sales system.
              </p>
            </div>
          </div>

          <SalesKpiGrid
            items={salesKpis}
            columns={4}
          />
        </section>

        {/* =========================================
            PIPELINE
        ========================================= */}

        <section className="sales-dashboard__section">
          <SalesPipeline
            stages={pipelineStages}
          />
        </section>

        {/* =========================================
            MAIN DASHBOARD GRID
        ========================================= */}

        <section className="sales-dashboard__grid">
          <SalesActivity
            activities={recentActivities}
            href="/sales"
          />

          <SalesFollowUps
            followUps={followUps}
            href="/sales/orders"
          />
        </section>

        {/* =========================================
            QUICK ACTIONS
        ========================================= */}

        <section className="sales-dashboard__section">
          <SalesQuickActions
            actions={quickActions}
          />
        </section>

        {/* =========================================
            MODULE NAVIGATION
        ========================================= */}

        <section className="sales-dashboard__modules">
          <div className="sales-dashboard__section-heading">
            <div>
              <h2>Sales Modules</h2>

              <p>
                Manage the complete customer-to-order sales
                workflow.
              </p>
            </div>
          </div>

          <div className="sales-dashboard__module-grid">
            <Link
              href="/sales/customers"
              className="sales-dashboard__module"
            >
              <div className="sales-dashboard__module-icon">
                <Users
                  size={18}
                  strokeWidth={1.8}
                />
              </div>

              <div className="sales-dashboard__module-content">
                <strong>Customers</strong>

                <span>
                  Customer accounts and relationship records.
                </span>
              </div>
            </Link>

            <Link
              href="/sales/orders"
              className="sales-dashboard__module"
            >
              <div className="sales-dashboard__module-icon">
                <ClipboardList
                  size={18}
                  strokeWidth={1.8}
                />
              </div>

              <div className="sales-dashboard__module-content">
                <strong>Sales Orders</strong>

                <span>
                  Manage confirmed customer orders.
                </span>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}