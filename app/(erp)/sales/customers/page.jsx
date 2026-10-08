"use client";

import {
  Building2,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./Customers.css";

export default function CustomersPage() {
  const customers = [];

  return (
    <main className="sales-customers">
      <PageHeader
        eyebrow="Sales & CRM"
        title="Customers"
        description="Manage customer accounts, contacts, commercial information and sales relationships."
        action={
          <Button
            variant="primary"
            icon={Plus}
            disabled
          >
            Add Customer
          </Button>
        }
      />

      <div className="sales-customers__content">
        {/* =========================================
            CONNECTION NOTICE
        ========================================= */}

        <section className="sales-customers__notice">
          <div className="sales-customers__notice-icon">
            <Building2
              size={17}
              strokeWidth={1.8}
            />
          </div>

          <div className="sales-customers__notice-content">
            <strong>Customer database not connected</strong>

            <span>
              Customer records will appear here after the
              database and Sales API are connected.
            </span>
          </div>
        </section>

        {/* =========================================
            STATS
        ========================================= */}

        <section className="sales-customers__stats">
          <div className="sales-customers__stat">
            <span>Total Customers</span>
            <strong>0</strong>
          </div>

          <div className="sales-customers__stat">
            <span>Active Customers</span>
            <strong>0</strong>
          </div>

          <div className="sales-customers__stat">
            <span>New This Month</span>
            <strong>0</strong>
          </div>

          <div className="sales-customers__stat">
            <span>Pending Review</span>
            <strong>0</strong>
          </div>
        </section>

        {/* =========================================
            TOOLBAR
        ========================================= */}

        <section className="sales-customers__toolbar">
          <div className="sales-customers__search">
            <Input
              placeholder="Search customers..."
              icon={Search}
              disabled
            />
          </div>

          <div className="sales-customers__filters">
            <Button
              variant="secondary"
              icon={Filter}
              disabled
            >
              Status
            </Button>

            <Button
              variant="secondary"
              icon={SlidersHorizontal}
              disabled
            >
              Filters
            </Button>
          </div>
        </section>

        {/* =========================================
            CUSTOMER TABLE / EMPTY STATE
        ========================================= */}

        <section className="sales-customers__table-card">
          {customers.length > 0 ? (
            <div className="sales-customers__table">
              {/* Backend table will be rendered here */}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No customers available"
              description="Customer records will appear here once the Sales database is connected."
              action={
                <Button
                  variant="primary"
                  icon={Plus}
                  disabled
                >
                  Add Customer
                </Button>
              }
            />
          )}
        </section>

        {/* =========================================
            CUSTOMER DATA MODEL
        ========================================= */}

        <section className="sales-customers__info">
          <div className="sales-customers__info-header">
            <div>
              <h2>Customer Master</h2>

              <p>
                The customer module will store the core
                commercial and relationship information used
                throughout Sales & CRM.
              </p>
            </div>
          </div>

          <div className="sales-customers__fields">
            <div>
              <strong>Company / Customer</strong>
              <span>Legal or trading name</span>
            </div>

            <div>
              <strong>Contact</strong>
              <span>Primary contact information</span>
            </div>

            <div>
              <strong>Commercial</strong>
              <span>Currency, payment terms and credit data</span>
            </div>

            <div>
              <strong>Address</strong>
              <span>Billing and shipping locations</span>
            </div>

            <div>
              <strong>Classification</strong>
              <span>Customer type and market segment</span>
            </div>

            <div>
              <strong>Status</strong>
              <span>Active, inactive or under review</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}