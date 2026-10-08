"use client";

import { ScrollText, Search } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./Audit.css";

/*
 * Audit Logs.
 *
 * Audit record (backend entity mirror):
 * {
 *   entityType,        // Order, Stage, Inventory, Quality, ...
 *   entityId,
 *   action,            // created | updated | status_changed | ...
 *   field,             // e.g. status, quantity
 *   oldValue,          // old status / old quantity
 *   newValue,          // new status / new quantity
 *   userId,            // user who made the change
 *   timestamp,
 *   remarks
 * }
 *
 * Created By / Created At / Updated By / Updated At are tracked
 * on the backend entities themselves.
 */

const AUDIT_ENTRIES = [];

const AUDIT_COLUMNS = [
  "Entity",
  "Entity ID",
  "Action",
  "Field",
  "Old Value",
  "New Value",
  "User",
  "Timestamp",
  "Remarks",
];

export default function AuditPage() {
  return (
    <main className="admin-audit">
      <PageHeader
        eyebrow="Administration"
        title="Audit Logs"
        description="Important changes across orders, stages, inventory, quality, packing and dispatch — who changed what, when, from which value to which."
      />

      <div className="admin-audit__content">
        <section className="admin-audit__toolbar">
          <div className="admin-audit__search">
            <Input
              placeholder="Search audit logs by entity, user, action..."
              icon={Search}
            />
          </div>
        </section>

        <section className="admin-audit__table-card">
          {AUDIT_ENTRIES.length > 0 ? (
            <div className="admin-audit__table">
              {/* Backend audit log table renders here */}
            </div>
          ) : (
            <>
              <div className="admin-audit__columns">
                {AUDIT_COLUMNS.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>

              <EmptyState
                icon={ScrollText}
                title="No audit entries"
                description="Audit entries will be recorded by the backend as users create and change records. Created By / Updated By and timestamps are tracked per entity."
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
