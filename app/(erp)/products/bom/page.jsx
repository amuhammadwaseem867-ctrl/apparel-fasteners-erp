"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  ChevronDown,
  ClipboardList,
  Layers3,
  Plus,
  Search,
  Settings2,
  Wrench,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import "./BOM.css";

const BOM_TYPES = [
  {
    id: "garments",
    name: "Garment BOM",
    description:
      "Define fabrics, accessories, trims and components required to manufacture a garment.",
    icon: Layers3,
    examples: [
      "Main Fabric",
      "Lining",
      "Zipper",
      "Buttons",
      "Labels",
    ],
  },
  {
    id: "fabrics",
    name: "Fabric BOM",
    description:
      "Define yarns, fibers, finishes and processing materials used for fabric production.",
    icon: Box,
    examples: [
      "Fiber",
      "Yarn",
      "Dyes",
      "Finish",
      "Processing Material",
    ],
  },
  {
    id: "accessories",
    name: "Accessory BOM",
    description:
      "Define component materials and supporting parts used to produce garment accessories.",
    icon: Wrench,
    examples: [
      "Base Material",
      "Slider",
      "Tape",
      "Teeth",
      "Packaging",
    ],
  },
];

const BOM_STATUS = [
  "All Status",
  "Draft",
  "Active",
  "Inactive",
];

export default function ProductBOMPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All Status");
  const [showFilters, setShowFilters] = useState(false);

  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return BOM_TYPES;
    }

    return BOM_TYPES.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.examples.some((example) =>
          example.toLowerCase().includes(query)
        )
      );
    });
  }, [search]);

  function clearFilters() {
    setSearch("");
    setStatus("All Status");
  }

  return (
    <div className="bom-page">
      <PageHeader
        eyebrow="Product Master"
        title="Bill of Materials"
        description="Define materials, components and production requirements for products."
        action={
          <div className="bom-page__header-actions">
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
              Add BOM
            </Button>
          </div>
        }
      />

      <div className="bom-notice">
        <div className="bom-notice__icon">
          <Settings2
            size={17}
            strokeWidth={1.8}
          />
        </div>

        <div className="bom-notice__content">
          <strong>
            BOM data is waiting for the backend
          </strong>

          <p>
            BOM structures are prepared for the product master.
            Product components, quantities, wastage and costing
            will load from the database after backend integration.
          </p>
        </div>

        <Badge variant="success">
          Frontend Ready
        </Badge>
      </div>

      <section className="bom-stats">
        <Card className="bom-stat">
          <span className="bom-stat__label">
            BOM Records
          </span>

          <strong>0</strong>

          <small>
            No BOM records created
          </small>
        </Card>

        <Card className="bom-stat">
          <span className="bom-stat__label">
            BOM Types
          </span>

          <strong>
            {BOM_TYPES.length}
          </strong>

          <small>
            Product divisions
          </small>
        </Card>

        <Card className="bom-stat">
          <span className="bom-stat__label">
            Components
          </span>

          <strong>0</strong>

          <small>
            Awaiting product data
          </small>
        </Card>

        <Card className="bom-stat">
          <span className="bom-stat__label">
            Versions
          </span>

          <strong>0</strong>

          <small>
            No revisions yet
          </small>
        </Card>
      </section>

      <Card
        className="bom-toolbar-card"
        padding={false}
      >
        <div className="bom-toolbar">
          <div className="bom-search">
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
              placeholder="Search BOM type or component..."
              aria-label="Search BOM"
            />
          </div>

          <div className="bom-toolbar__filters">
            <div className="bom-select">
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                aria-label="Filter BOM by status"
              >
                {BOM_STATUS.map((item) => (
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
              <ClipboardList size={16} />
              Filters
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="bom-advanced-filters">
            <div className="bom-filter-info">
              <Settings2 size={16} />

              <span>
                Product, component, quantity and costing
                filters will become available with backend
                data.
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
        className="bom-types-card"
        title="BOM Configuration"
        description="Production structures prepared for each product division."
        padding={false}
      >
        <div className="bom-types-header">
          <div>
            <span>
              Configured Structures
            </span>

            <strong>
              {filteredTypes.length} BOM types
            </strong>
          </div>

          <Badge variant="success">
            Structure Ready
          </Badge>
        </div>

        <div className="bom-types-grid">
          {filteredTypes.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="bom-type"
                key={item.id}
              >
                <div className="bom-type__top">
                  <div className="bom-type__icon">
                    <Icon
                      size={20}
                      strokeWidth={1.8}
                    />
                  </div>

                  <Badge variant="success">
                    Active Structure
                  </Badge>
                </div>

                <div className="bom-type__body">
                  <div className="bom-type__title">
                    <h3>{item.name}</h3>

                    <ArrowUpRight
                      size={16}
                      strokeWidth={1.8}
                    />
                  </div>

                  <p>
                    {item.description}
                  </p>
                </div>

                <div className="bom-type__components">
                  <span>
                    Typical components
                  </span>

                  <div>
                    {item.examples.map(
                      (example) => (
                        <span key={example}>
                          {example}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="bom-type__footer">
                  <span>
                    BOM records
                  </span>

                  <strong>0</strong>
                </div>
              </article>
            );
          })}

          {filteredTypes.length === 0 && (
            <div className="bom-empty">
              <Search size={21} />

              <h3>
                No BOM type found
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

      <section className="bom-workflow">
        <div className="bom-section-heading">
          <span>
            BOM Workflow
          </span>

          <h2>
            Production Structure
          </h2>

          <p>
            BOM data will connect product specifications
            with material planning, procurement, inventory
            consumption and production.
          </p>
        </div>

        <div className="bom-workflow-grid">
          <div className="bom-workflow-step">
            <span>01</span>

            <div>
              <strong>
                Product
              </strong>

              <p>
                Finished product or material definition.
              </p>
            </div>
          </div>

          <div className="bom-workflow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="bom-workflow-step">
            <span>02</span>

            <div>
              <strong>
                Components
              </strong>

              <p>
                Materials, trims and required components.
              </p>
            </div>
          </div>

          <div className="bom-workflow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="bom-workflow-step">
            <span>03</span>

            <div>
              <strong>
                Quantity
              </strong>

              <p>
                Required quantity, unit and wastage.
              </p>
            </div>
          </div>

          <div className="bom-workflow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="bom-workflow-step">
            <span>04</span>

            <div>
              <strong>
                Production
              </strong>

              <p>
                MRP, procurement and material consumption.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}