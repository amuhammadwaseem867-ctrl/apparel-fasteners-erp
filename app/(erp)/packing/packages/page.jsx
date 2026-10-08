"use client";

import { Package, Search } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "../PackingPages.css";

const PACKAGES = [];

export default function PackagesPage() {
  return (
    <main className="packing-pages">
      <PageHeader
        eyebrow="Factory Operations / Packing"
        title="Packages"
        description="Individual packages created by packing: package type, count, weight, dimensions and contents."
      />

      <div className="packing-pages__content">
        <section className="packing-pages__toolbar">
          <div className="packing-pages__search">
            <Input
              placeholder="Search packages by order, package number, type..."
              icon={Search}
            />
          </div>
        </section>

        <section className="packing-pages__list-card">
          {PACKAGES.length > 0 ? (
            <div className="packing-pages__table" />
          ) : (
            <EmptyState
              icon={Package}
              title="No packages"
              description="Packages will appear here once packing is recorded and the backend is connected."
            />
          )}
        </section>
      </div>
    </main>
  );
}
