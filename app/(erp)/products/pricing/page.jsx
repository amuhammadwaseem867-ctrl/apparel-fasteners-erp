"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Percent,
  Plus,
  Search,
  Settings2,
  Tag,
  WalletCards,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import "./Pricing.css";

const PRICING_STRUCTURES = [
  {
    id: "purchase",
    title: "Purchase Pricing",
    description:
      "Define supplier purchase costs, standard costs and minimum purchase prices.",
    icon: WalletCards,
    fields: [
      "Purchase Cost",
      "Standard Cost",
      "Supplier Price",
      "Minimum Purchase Price",
    ],
  },
  {
    id: "sales",
    title: "Sales Pricing",
    description:
      "Manage selling prices, wholesale pricing and customer-specific pricing.",
    icon: Tag,
    fields: [
      "Selling Price",
      "Wholesale Price",
      "Customer Price",
      "Price Lists",
    ],
  },
  {
    id: "margin",
    title: "Margin Management",
    description:
      "Configure target margins, minimum margins and permitted discounts.",
    icon: Percent,
    fields: [
      "Target Margin",
      "Minimum Margin",
      "Discount Limit",
      "Margin Rules",
    ],
  },
  {
    id: "tax",
    title: "Tax Treatment",
    description:
      "Configure taxable, zero-rated, exempt and non-taxable pricing treatment.",
    icon: Calculator,
    fields: [
      "Tax Rate",
      "Tax Treatment",
      "Inclusive / Exclusive",
      "Tax Category",
    ],
  },
];

const CURRENCIES = [
  "All Currencies",
  "PKR",
  "USD",
  "EUR",
  "GBP",
  "CNY",
  "HKD",
];

const PRICING_STATUS = [
  "All Status",
  "Active",
  "Draft",
  "Inactive",
];

export default function ProductPricingPage() {
  const [search, setSearch] = useState("");
  const [currency, setCurrency] =
    useState("All Currencies");
  const [status, setStatus] =
    useState("All Status");
  const [showFilters, setShowFilters] =
    useState(false);

  const filteredStructures = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return PRICING_STRUCTURES;
    }

    return PRICING_STRUCTURES.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.fields.some((field) =>
          field.toLowerCase().includes(query)
        )
      );
    });
  }, [search]);

  function clearFilters() {
    setSearch("");
    setCurrency("All Currencies");
    setStatus("All Status");
  }

  return (
    <div className="pricing-page">
      <PageHeader
        eyebrow="Product Master"
        title="Pricing"
        description="Manage product costs, selling prices, margins and tax treatment."
        action={
          <div className="pricing-page__header-actions">
            <Link href="/products">
              <Button
                variant="secondary"
                icon={ArrowLeft}
              >
                Products
              </Button>
            </Link>

            <Button
              icon={Plus}
              disabled
            >
              Add Price Rule
            </Button>
          </div>
        }
      />

      <div className="pricing-notice">
        <div className="pricing-notice__icon">
          <Settings2
            size={17}
            strokeWidth={1.8}
          />
        </div>

        <div className="pricing-notice__content">
          <strong>
            Pricing data is waiting for the backend
          </strong>

          <p>
            Pricing structures are ready. Product prices,
            supplier pricing, margins, currencies and tax
            rules will load from the database after backend
            integration.
          </p>
        </div>

        <Badge variant="success">
          Frontend Ready
        </Badge>
      </div>

      <section className="pricing-stats">
        <Card className="pricing-stat">
          <span>Price Records</span>
          <strong>0</strong>
          <small>
            No pricing records created
          </small>
        </Card>

        <Card className="pricing-stat">
          <span>Price Lists</span>
          <strong>0</strong>
          <small>
            No price lists configured
          </small>
        </Card>

        <Card className="pricing-stat">
          <span>Currencies</span>
          <strong>6</strong>
          <small>
            Supported currencies
          </small>
        </Card>

        <Card className="pricing-stat">
          <span>Tax Rules</span>
          <strong>0</strong>
          <small>
            Awaiting tax configuration
          </small>
        </Card>
      </section>

      <Card
        className="pricing-toolbar-card"
        padding={false}
      >
        <div className="pricing-toolbar">
          <div className="pricing-search">
            <Search
              size={17}
              strokeWidth={1.8}
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search pricing structure..."
              aria-label="Search pricing"
            />
          </div>

          <div className="pricing-toolbar__filters">
            <div className="pricing-select">
              <select
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value)
                }
                aria-label="Filter by currency"
              >
                {CURRENCIES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>

              <ChevronDown size={15} />
            </div>

            <div className="pricing-select">
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                aria-label="Filter by pricing status"
              >
                {PRICING_STATUS.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>

              <ChevronDown size={15} />
            </div>

            <Button
              variant={
                showFilters
                  ? "secondary"
                  : "ghost"
              }
              onClick={() =>
                setShowFilters((current) => !current)
              }
            >
              <Settings2 size={16} />
              Filters
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="pricing-advanced-filters">
            <div className="pricing-filter-info">
              <FileText size={16} />

              <span>
                Product, supplier, customer, price list and
                effective-date filters will become available
                with backend data.
              </span>
            </div>

            <Button
              variant="ghost"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </Card>

      <Card
        className="pricing-structures-card"
        title="Pricing Configuration"
        description="Pricing structures prepared for the product master."
        padding={false}
      >
        <div className="pricing-structures-header">
          <div>
            <span>
              Configured Structures
            </span>

            <strong>
              {filteredStructures.length} pricing structures
            </strong>
          </div>

          <Badge variant="success">
            Structure Ready
          </Badge>
        </div>

        <div className="pricing-structures-grid">
          {filteredStructures.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="pricing-structure"
                key={item.id}
              >
                <div className="pricing-structure__top">
                  <div className="pricing-structure__icon">
                    <Icon
                      size={20}
                      strokeWidth={1.8}
                    />
                  </div>

                  <Badge variant="success">
                    Ready
                  </Badge>
                </div>

                <div className="pricing-structure__body">
                  <div className="pricing-structure__title">
                    <h3>
                      {item.title}
                    </h3>

                    <ArrowUpRight
                      size={16}
                      strokeWidth={1.8}
                    />
                  </div>

                  <p>
                    {item.description}
                  </p>
                </div>

                <div className="pricing-structure__fields">
                  <span>
                    Configuration fields
                  </span>

                  <div>
                    {item.fields.map(
                      (field) => (
                        <span key={field}>
                          {field}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="pricing-structure__footer">
                  <span>
                    Records
                  </span>

                  <strong>0</strong>
                </div>
              </article>
            );
          })}

          {filteredStructures.length === 0 && (
            <div className="pricing-empty">
              <Search size={21} />

              <h3>
                No pricing structure found
              </h3>

              <p>
                Try another search term.
              </p>

              <Button
                variant="secondary"
                onClick={clearFilters}
              >
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </Card>

      <section className="pricing-rules">
        <div className="pricing-section-heading">
          <span>
            Pricing Logic
          </span>

          <h2>
            Pricing Flow
          </h2>

          <p>
            Product pricing will connect procurement cost,
            inventory valuation, sales pricing, margins and
            tax treatment across the ERP.
          </p>
        </div>

        <div className="pricing-flow">
          <div className="pricing-flow-step">
            <span>01</span>

            <div>
              <strong>
                Cost
              </strong>

              <p>
                Purchase and standard cost.
              </p>
            </div>
          </div>

          <div className="pricing-flow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="pricing-flow-step">
            <span>02</span>

            <div>
              <strong>
                Margin
              </strong>

              <p>
                Target and minimum margin.
              </p>
            </div>
          </div>

          <div className="pricing-flow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="pricing-flow-step">
            <span>03</span>

            <div>
              <strong>
                Sales Price
              </strong>

              <p>
                Retail, wholesale and customer pricing.
              </p>
            </div>
          </div>

          <div className="pricing-flow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="pricing-flow-step">
            <span>04</span>

            <div>
              <strong>
                Tax
              </strong>

              <p>
                Applicable tax treatment and rate.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}