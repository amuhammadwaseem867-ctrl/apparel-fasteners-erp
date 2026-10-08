"use client";

import { PackageCheck, Search } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "../PackingPages.css";

const COMPLETED = [];

export default function CompletedPackingPage() {
  return (
    <main className="packing-pages">
      <PageHeader
        eyebrow="Factory Operations / Packing"
        title="Completed Packing"
        description="Fully packed orders awaiting handoff to dispatch as Ready for Delivery."
      />

      <div className="packing-pages__content">
        <section className="packing-pages__toolbar">
          <div className="packing-pages__search">
            <Input
              placeholder="Search completed packing by order, customer, date..."
              icon={Search}
            />
          </div>
        </section>

        <section className="packing-pages__list-card">
          {COMPLETED.length > 0 ? (
            <div className="packing-pages__table" />
          ) : (
            <EmptyState
              icon={PackageCheck}
              title="No completed packing"
              description="Completed packing records will appear here once orders are fully packed and the backend is connected."
            />
          )}
        </section>
      </div>
    </main>
  );
}
