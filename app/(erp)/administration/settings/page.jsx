"use client";

import { SlidersHorizontal } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import { ROLES } from "@/config/roles";
import { MOVEMENT_TYPES } from "@/config/items";
import { ORDER_STATUSES } from "@/config/orders";
import { PRODUCTION_STAGES } from "@/config/production";

import "./Settings.css";

export default function SystemSettingsPage() {
  return (
    <main className="admin-settings">
      <PageHeader
        eyebrow="Administration"
        title="System Settings"
        description="Static system configuration used across the ERP: statuses, stages, movement types and roles."
      />

      <div className="admin-settings__content">
        <section className="admin-settings__card">
          <h2>Order Statuses</h2>

          <div className="admin-settings__chips">
            {ORDER_STATUSES.map((status) => (
              <span key={status.id}>{status.label}</span>
            ))}
          </div>
        </section>

        <section className="admin-settings__card">
          <h2>Production Stages</h2>

          <div className="admin-settings__chips">
            {PRODUCTION_STAGES.map((stage) => (
              <span key={stage.key}>
                {stage.sequence}. {stage.label}
              </span>
            ))}
          </div>
        </section>

        <section className="admin-settings__card">
          <h2>Warehouse Movement Types</h2>

          <div className="admin-settings__chips">
            {MOVEMENT_TYPES.map((type) => (
              <span key={type.id}>{type.label}</span>
            ))}
          </div>
        </section>

        <section className="admin-settings__card">
          <h2>Roles</h2>

          <div className="admin-settings__chips">
            {ROLES.map((role) => (
              <span key={role.id}>{role.label}</span>
            ))}
          </div>
        </section>

        <section className="admin-settings__note">
          <SlidersHorizontal size={17} strokeWidth={1.8} />

          <span>
            Configuration is code-defined for now; runtime editing
            will be enabled by the backend once connected.
          </span>
        </section>
      </div>
    </main>
  );
}
