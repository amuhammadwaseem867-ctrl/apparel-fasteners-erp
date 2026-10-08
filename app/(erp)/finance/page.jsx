"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Landmark,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import "./FinanceDashboard.css";

const financeModules = [
  {
    title: "Accounts",
    description: "Manage financial accounts and account classifications.",
    href: "/finance/accounts",
    icon: Landmark,
  },
  {
    title: "Income",
    description: "Record and manage incoming financial transactions.",
    href: "/finance/income",
    icon: ArrowDownLeft,
  },
  {
    title: "Expenses",
    description: "Track operational and business expenses.",
    href: "/finance/expenses",
    icon: ArrowUpRight,
  },
  {
    title: "Invoices",
    description: "Create, manage and track customer invoices.",
    href: "/finance/invoices",
    icon: FileText,
  },
  {
    title: "Payments",
    description: "Record received and outgoing payments.",
    href: "/finance/payments",
    icon: CreditCard,
  },
  {
    title: "Receivables",
    description: "Monitor outstanding customer balances.",
    href: "/finance/receivables",
    icon: Wallet,
  },
  {
    title: "Payables",
    description: "Monitor supplier and business obligations.",
    href: "/finance/payables",
    icon: Receipt,
  },
  {
    title: "Cash & Bank",
    description: "Manage cash accounts and bank transactions.",
    href: "/finance/cash-bank",
    icon: Banknote,
  },
  {
    title: "Transactions",
    description: "Review the complete financial transaction ledger.",
    href: "/finance/transactions",
    icon: RefreshCw,
  },
  {
    title: "Financial Reports",
    description: "Review financial reporting and analysis.",
    href: "/finance/reports",
    icon: BarChart3,
  },
];

export default function FinancePage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("current-month");

  const filteredModules = financeModules.filter((module) => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      module.title.toLowerCase().includes(query) ||
      module.description.toLowerCase().includes(query)
    );
  });

  const handleRefresh = () => {
    /*
      Backend refresh will be connected here.
      Keep the action available so the page is ready
      for API/data fetching later.
    */

    setSearch("");
    setPeriod("current-month");
  };

  return (
    <div className="finance-page">
      <PageHeader
        eyebrow="FINANCE"
        title="Finance Overview"
        description="Centralized financial management for accounts, transactions, invoices, payments and reporting."
        action={
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => {
              router.push("/finance/transactions");
            }}
          >
            New Transaction
          </Button>
        }
      />

      <section className="finance-toolbar">
        <div className="finance-search">
          <Search
            size={17}
            strokeWidth={1.8}
            aria-hidden="true"
          />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search finance modules..."
            aria-label="Search finance modules"
          />
        </div>

        <div className="finance-toolbar__actions">
          <div className="finance-period">
            <CalendarDays
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label="Financial reporting period"
            >
              <option value="current-month">
                Current Month
              </option>

              <option value="previous-month">
                Previous Month
              </option>

              <option value="current-quarter">
                Current Quarter
              </option>

              <option value="current-year">
                Current Year
              </option>

              <option value="custom">
                Custom Period
              </option>
            </select>
          </div>

          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </section>

      <section className="finance-kpis">
        <FinanceKpi
          icon={CircleDollarSign}
          label="Total Income"
          value="—"
          description="No financial data"
        />

        <FinanceKpi
          icon={ArrowUpRight}
          label="Total Expenses"
          value="—"
          description="No financial data"
        />

        <FinanceKpi
          icon={Wallet}
          label="Receivables"
          value="—"
          description="No financial data"
        />

        <FinanceKpi
          icon={Receipt}
          label="Payables"
          value="—"
          description="No financial data"
        />
      </section>

      <section className="finance-main-grid">
        <div className="finance-panel finance-panel--modules">
          <div className="finance-panel__header">
            <div>
              <span className="finance-panel__eyebrow">
                FINANCIAL OPERATIONS
              </span>

              <h2>Finance Modules</h2>
            </div>

            <span className="finance-panel__count">
              {filteredModules.length}
            </span>
          </div>

          <div className="finance-module-grid">
            {filteredModules.map((module) => (
              <FinanceModuleCard
                key={module.href}
                {...module}
              />
            ))}
          </div>

          {filteredModules.length === 0 && (
            <EmptyState
              icon={Search}
              title="No modules found"
              description="Try another search term."
              size="small"
            />
          )}
        </div>

        <aside className="finance-panel finance-panel--activity">
          <div className="finance-panel__header">
            <div>
              <span className="finance-panel__eyebrow">
                ACTIVITY
              </span>

              <h2>Recent Transactions</h2>
            </div>
          </div>

          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Financial transactions will appear here once connected to the backend."
            size="small"
          />

          <Link
            href="/finance/transactions"
            className="finance-panel__link"
          >
            View transaction ledger
            <ChevronRight
              size={15}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Link>
        </aside>
      </section>

      <section className="finance-panel finance-panel--reports">
        <div className="finance-panel__header">
          <div>
            <span className="finance-panel__eyebrow">
              REPORTING
            </span>

            <h2>Financial Reporting</h2>

            <p>
              Access financial statements, transaction analysis,
              receivables, payables and account reporting.
            </p>
          </div>

          <Link
            href="/finance/reports"
            className="finance-view-link"
          >
            Open Reports
            <ChevronRight
              size={15}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Link>
        </div>

        <div className="finance-report-state">
          <BarChart3
            size={24}
            strokeWidth={1.7}
            aria-hidden="true"
          />

          <div>
            <strong>Reporting data unavailable</strong>

            <span>
              Connect the finance backend to populate financial
              statements and analytics.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function FinanceKpi({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <article className="finance-kpi">
      <div className="finance-kpi__icon">
        <Icon
          size={19}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>

      <div className="finance-kpi__content">
        <span>{label}</span>

        <strong>{value}</strong>

        <small>{description}</small>
      </div>
    </article>
  );
}

function FinanceModuleCard({
  title,
  description,
  href,
  icon: Icon,
}) {
  return (
    <Link
      href={href}
      className="finance-module-card"
    >
      <div className="finance-module-card__icon">
        <Icon
          size={19}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>

      <div className="finance-module-card__content">
        <h3>{title}</h3>

        <p>{description}</p>
      </div>

      <ChevronRight
        className="finance-module-card__arrow"
        size={17}
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </Link>
  );
}