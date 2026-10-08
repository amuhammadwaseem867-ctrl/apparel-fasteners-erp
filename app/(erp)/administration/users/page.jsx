"use client";

import { Plus, Search, Users } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { ROLES } from "@/config/roles";

import "./Users.css";

const USERS = [];

export default function UsersPage() {
  return (
    <main className="admin-users">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="System users, their assigned roles and account status."
        action={
          <Button variant="primary" icon={Plus} disabled>
            New User
          </Button>
        }
      />

      <div className="admin-users__content">
        <section className="admin-users__toolbar">
          <div className="admin-users__search">
            <Input
              placeholder="Search users by name, email, role..."
              icon={Search}
            />
          </div>

          <div className="admin-users__role-filter">
            <Button variant="secondary">
              All Roles
            </Button>

            {ROLES.map((role) => (
              <Button variant="secondary" key={role.id}>
                {role.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="admin-users__list-card">
          {USERS.length > 0 ? (
            <div className="admin-users__table" />
          ) : (
            <EmptyState
              icon={Users}
              title="No users"
              description="User accounts will appear here once authentication and the backend are connected."
            />
          )}
        </section>
      </div>
    </main>
  );
}
