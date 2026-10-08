"use client";

import { Scale } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import { PERMISSIONS, ROLES } from "@/config/roles";

import "./Roles.css";

/*
 * Roles & Permissions.
 *
 * Static configuration (allowed as system data). Permission
 * enforcement happens in the backend.
 */

function hasPermission(roleId, permissionId) {
  const role = ROLES.find((r) => r.id === roleId);

  return Boolean(role?.permissions.includes(permissionId));
}

export default function RolesPage() {
  return (
    <main className="admin-roles">
      <PageHeader
        eyebrow="Administration"
        title="Roles"
        description="System roles and their permissions: Admin, Management, Production, Warehouse, QC, Packing, Sales / Order Management and HR."
      />

      <div className="admin-roles__content">
        <section className="admin-roles__card">
          <div className="admin-roles__table-wrap">
            <table className="admin-roles__table">
              <thead>
                <tr>
                  <th>Permission</th>

                  {ROLES.map((role) => (
                    <th key={role.id}>{role.label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {PERMISSIONS.map((permission) => (
                  <tr key={permission.id}>
                    <td>
                      <strong>{permission.label}</strong>

                      <code>{permission.id}</code>
                    </td>

                    {ROLES.map((role) => {
                      const allowed = hasPermission(
                        role.id,
                        permission.id
                      );

                      return (
                        <td key={role.id}>
                          <span
                            className={`admin-roles__mark admin-roles__mark--${allowed ? "yes" : "no"
                              }`}
                          >
                            {allowed ? "Yes" : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-roles__note">
          <Scale size={17} strokeWidth={1.8} />

          <span>
            Roles are static configuration. Permission checks are
            enforced by the backend once connected.
          </span>
        </section>
      </div>
    </main>
  );
}
