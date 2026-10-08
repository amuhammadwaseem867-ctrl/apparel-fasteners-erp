"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "../ReportPage.css";

export default function Page() {
  return (
    <main className="report-page">
      <PageHeader
        eyebrow="Reporting"
        title="Dispatch Reports"
        description="Dispatches, shipments and delivery confirmations."
        action={
          <Link href="/reports">
            <Button variant="secondary" icon={ArrowLeft}>
              All Reports
            </Button>
          </Link>
        }
      />

      <div className="report-page__content">
        <section className="report-page__card">
          <EmptyState
            icon={BarChart3}
            title="No report data"
            description="Report data will appear once the backend is connected."
          />
        </section>
      </div>
    </main>
  );
}