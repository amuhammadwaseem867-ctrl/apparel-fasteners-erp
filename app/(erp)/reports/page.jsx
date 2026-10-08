"use client";

import Link from "next/link";
import { BarChart3, FileText } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

import "./Reports.css";

/*
 * Reports & Analytics.
 *
 * Report categories (backend-ready — datasets populate once the
 * backend is connected):
 *
 *  - Order Reports
 *  - Production Reports / Stage-wise Production / Production Completion
 *  - Wastage Reports / Rejection Reports
 *  - Quality Reports / NCR Reports / CAPA Reports
 *  - Inventory Reports / Stock Movement / WIP / Finished Goods
 *  - Packing Reports / Dispatch Reports / Delivery Reports
 */

const REPORT_GROUPS = [
  {
    title: "Orders & Sales",
    reports: [
      { label: "Order Reports", href: "/reports/orders" },
      { label: "Delivery Reports", href: "/reports/delivery" },
    ],
  },
  {
    title: "Production",
    reports: [
      { label: "Production Reports", href: "/reports/production" },
      { label: "Stage-wise Production", href: "/reports/production/stages" },
      { label: "Production Completion", href: "/reports/production/completion" },
      { label: "Wastage Reports", href: "/reports/production/wastage" },
      { label: "Rejection Reports", href: "/reports/production/rejections" },
    ],
  },
  {
    title: "Quality",
    reports: [
      { label: "Quality Reports", href: "/reports/quality" },
      { label: "NCR Reports", href: "/reports/quality/ncr" },
      { label: "CAPA Reports", href: "/reports/quality/capa" },
    ],
  },
  {
    title: "Inventory",
    reports: [
      { label: "Inventory Reports", href: "/reports/inventory" },
      { label: "Stock Movement Reports", href: "/reports/inventory/movements" },
      { label: "WIP Reports", href: "/reports/inventory/wip" },
      { label: "Finished Goods Reports", href: "/reports/inventory/finished-goods" },
    ],
  },
  {
    title: "Packing & Dispatch",
    reports: [
      { label: "Packing Reports", href: "/reports/packing" },
      { label: "Dispatch Reports", href: "/reports/dispatch" },
    ],
  },
];

export default function ReportsPage() {
  return (
    <main className="reports">
      <PageHeader
        eyebrow="Reporting"
        title="Reports & Analytics"
        description="Factory reporting across orders, production stages, quality, inventory, packing and dispatch."
      />

      <div className="reports__content">
        <section className="reports__notice">
          <div className="reports__notice-icon">
            <BarChart3 size={17} strokeWidth={1.8} />
          </div>

          <div className="reports__notice-content">
            <strong>Report datasets not connected</strong>

            <span>
              Report data will populate once the backend is
              connected. Categories below define the reporting
              structure.
            </span>
          </div>
        </section>

        <section className="reports__groups">
          {REPORT_GROUPS.map((group) => (
            <div className="reports__group" key={group.title}>
              <div className="reports__group-heading">
                <h2>{group.title}</h2>
              </div>

              <div className="reports__group-items">
                {group.reports.map((report) => (
                  <Link
                    href={report.href}
                    className="reports__item"
                    key={report.href}
                  >
                    <FileText size={16} strokeWidth={1.8} />

                    <span>{report.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
