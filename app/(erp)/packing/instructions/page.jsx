"use client";

import { Package, Search } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "../PackingPages.css";

const INSTRUCTIONS = [];

export default function PackingInstructionsPage() {
  return (
    <main className="packing-pages">
      <PageHeader
        eyebrow="Factory Operations / Packing"
        title="Packing Instructions"
        description="Per-order packing instructions: package type, count, weight, dimensions and special handling."
      />

      <div className="packing-pages__content">
        <section className="packing-pages__toolbar">
          <div className="packing-pages__search">
            <Input
              placeholder="Search instructions by order, SKU, package type..."
              icon={Search}
            />
          </div>
        </section>

        <section className="packing-pages__list-card">
          {INSTRUCTIONS.length > 0 ? (
            <div className="packing-pages__table" />
          ) : (
            <EmptyState
              icon={Package}
              title="No packing instructions"
              description="Packing instructions are attached to orders once the backend is connected."
            />
          )}
        </section>
      </div>
    </main>
  );
}
