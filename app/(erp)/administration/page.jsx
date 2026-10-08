"use client";

import Link from "next/link";
import { Settings, Users, Scale, ScrollText, SlidersHorizontal } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";

import "./Administration.css";

const ADMIN_MODULES = [
  {
    title: "Users",
    description: "Manage system users and their roles.",
    href: "/administration/users",
    icon: Users,
  },
  {
    title: "Roles",
    description: "Roles and permission assignments.",
    href: "/administration/roles",
    icon: Scale,
  },
  {
    title: "Audit Logs",
    description: "Track important changes across the ERP.",
    href: "/administration/audit",
    icon: ScrollText,
  },
  {
    title: "System Settings",
    description: "Global system configuration.",
    href: "/administration/settings",
    icon: SlidersHorizontal,
  },
];

export default function AdministrationPage() {
  return (
    <main className="administration">
      <PageHeader
        eyebrow="Administration"
        title="Administration"
        description="Users, roles and permissions, audit logs and system settings."
      />

      <div className="administration__content">
        <section className="administration__modules">
          {ADMIN_MODULES.map((module) => {
            const Icon = module.icon;

            return (
              <Link
                href={module.href}
                className="administration__module"
                key={module.href}
              >
                <div className="administration__module-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </div>

                <div className="administration__module-content">
                  <strong>{module.title}</strong>

                  <span>{module.description}</span>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="administration__note">
          <Settings size={17} strokeWidth={1.8} />

          <span>
            Authentication, permissions enforcement and audit
            recording are handled by the backend once connected.
          </span>
        </section>
      </div>
    </main>
  );
}
