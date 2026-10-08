"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Box,
  CheckCircle2,
  ChevronDown,
  Layers3,
  Package,
  Plus,
  Search,
  Shirt,
  SlidersHorizontal,
  Tag,
  Warehouse,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card, { StatCard } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import "./Products.css";

const DIVISIONS = [
  "All Divisions",
  "Garments",
  "Fabrics",
  "Garment Accessories",
];

const STATUS_OPTIONS = [
  "All Status",
  "active",
  "draft",
  "inactive",
];

function getStatusLabel(status) {
  switch (status) {
    case "active":
      return "Active";
    case "draft":
      return "Draft";
    case "inactive":
      return "Inactive";
    default:
      return status;
  }
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("All Divisions");
  const [status, setStatus] = useState("All Status");
  const [showFilters, setShowFilters] = useState(false);

  function clearFilters() {
    setSearch("");
    setDivision("All Divisions");
    setStatus("All Status");
  }

  return (
    <div className="products-page">
      <PageHeader
        eyebrow="Product Master"
        title="Products"
        description="Manage garments, fabrics and garment accessories from a single product master."
        action={
          <Link href="/products/new">
            <Button variant="primary">
              <Plus size={16} strokeWidth={2} />
              Add Product
            </Button>
          </Link>
        }
      />

      <section className="products-stats">
        <StatCard
          label="Total Products"
          value="0"
          description="No products created yet"
          icon={Package}
        />

        <StatCard
          label="Active Products"
          value="0"
          description="Currently available"
          icon={CheckCircle2}
        />

        <StatCard
          label="Garments"
          value="0"
          description="Garment products"
          icon={Shirt}
        />

        <StatCard
          label="Fabrics"
          value="0"
          description="Fabric products"
          icon={Layers3}
        />

        <StatCard
          label="Accessories"
          value="0"
          description="Garment accessories"
          icon={Tag}
        />
      </section>

      <div className="products-backend-notice">
        <div className="products-backend-notice__icon">
          <Warehouse size={17} strokeWidth={1.8} />
        </div>

        <div className="products-backend-notice__content">
          <strong>Product database is not connected yet</strong>

          <p>
            The product master interface is ready. Product records,
            inventory, pricing and status data will load from the backend
            when the database and API layer are connected.
          </p>
        </div>

        <Badge variant="success">Frontend Ready</Badge>
      </div>

      <Card
        className="products-toolbar-card"
        padding={false}
      >
        <div className="products-toolbar">
          <div className="products-search">
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
              placeholder="Search product, SKU or category..."
              aria-label="Search products"
            />
          </div>

          <div className="products-toolbar__filters">
            <div className="products-select">
              <select
                value={division}
                onChange={(event) =>
                  setDivision(event.target.value)
                }
                aria-label="Filter by division"
              >
                {DIVISIONS.map((item) => (
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

            <div className="products-select">
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item === "All Status"
                      ? item
                      : getStatusLabel(item)}
                  </option>
                ))}
              </select>

              <ChevronDown size={15} />
            </div>

            <Button
              variant={
                showFilters ? "secondary" : "ghost"
              }
              onClick={() =>
                setShowFilters((current) => !current)
              }
            >
              <SlidersHorizontal size={16} />
              Filters
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="products-advanced-filters">
            <div className="products-filter-info">
              <SlidersHorizontal size={16} />

              <span>
                Advanced filters will become available when
                inventory, pricing and supplier data are connected.
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
        className="products-table-card"
        padding={false}
      >
        <div className="products-table-header">
          <div>
            <h2>Product Records</h2>

            <p>
              No product records available
            </p>
          </div>

          <div className="products-table-header__meta">
            <Warehouse size={16} />
            <span>Master Inventory</span>
          </div>
        </div>

        <div className="products-empty-state">
          <div className="products-empty-state__icon">
            <Box
              size={26}
              strokeWidth={1.7}
            />
          </div>

          <h3>No products found</h3>

          <p>
            Product records will appear here once they are
            created and connected to the database.
          </p>

          <Link href="/products/new">
            <Button
              variant="primary"
              icon={Plus}
            >
              Create First Product
            </Button>
          </Link>
        </div>
      </Card>

      <section className="products-tools">
        <div className="products-section-heading">
          <div>
            <span>Product Configuration</span>

            <h2>Product Master Tools</h2>

            <p>
              Configure the supporting structures used by
              product records.
            </p>
          </div>
        </div>

        <div className="products-tools-grid">
          <Link
            href="/products/categories"
            className="products-tool"
          >
            <div className="products-tool__icon">
              <Layers3 size={19} strokeWidth={1.8} />
            </div>

            <div className="products-tool__content">
              <div className="products-tool__title">
                <h3>Categories</h3>
                <ArrowUpRight size={16} />
              </div>

              <p>
                Manage divisions and subcategories across the
                product master.
              </p>
            </div>
          </Link>

          <Link
            href="/products/variants"
            className="products-tool"
          >
            <div className="products-tool__icon">
              <SlidersHorizontal
                size={19}
                strokeWidth={1.8}
              />
            </div>

            <div className="products-tool__content">
              <div className="products-tool__title">
                <h3>Variants</h3>
                <ArrowUpRight size={16} />
              </div>

              <p>
                Configure size, color, width and finish based
                product variations.
              </p>
            </div>
          </Link>

          <Link
            href="/products/bom"
            className="products-tool"
          >
            <div className="products-tool__icon">
              <Box size={19} strokeWidth={1.8} />
            </div>

            <div className="products-tool__content">
              <div className="products-tool__title">
                <h3>BOM</h3>
                <ArrowUpRight size={16} />
              </div>

              <p>
                Define materials, components and production
                requirements.
              </p>
            </div>
          </Link>

          <Link
            href="/products/pricing"
            className="products-tool"
          >
            <div className="products-tool__icon">
              <Tag size={19} strokeWidth={1.8} />
            </div>

            <div className="products-tool__content">
              <div className="products-tool__title">
                <h3>Pricing</h3>
                <ArrowUpRight size={16} />
              </div>

              <p>
                Manage purchase cost, selling prices, margins
                and tax treatment.
              </p>
            </div>
          </Link>

          <Link
            href="/products/documents"
            className="products-tool"
          >
            <div className="products-tool__icon">
              <Package size={19} strokeWidth={1.8} />
            </div>

            <div className="products-tool__content">
              <div className="products-tool__title">
                <h3>Documents</h3>
                <ArrowUpRight size={16} />
              </div>

              <p>
                Manage technical sheets, certificates and
                product documentation.
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}