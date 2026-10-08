"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Plus,
  Search,
  Settings2,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";

import "./Categories.css";

const CATEGORY_STRUCTURE = [
  {
    id: "garments",
    name: "Garments",
    description: "Finished apparel and garment products.",
    children: [
      "Jackets",
      "Sweaters",
      "Denim",
      "Bomber Jackets",
      "Leather Garments",
      "Other Garments",
    ],
  },
  {
    id: "fabrics",
    name: "Fabrics",
    description: "Woven, knit, sustainable and technical fabrics.",
    children: [
      "Woven",
      "Knit",
      "Sustainable",
      "Technical",
      "Natural Fibers",
      "Recycled",
      "Specialty",
    ],
  },
  {
    id: "garment-accessories",
    name: "Garment Accessories",
    description: "Fasteners, trims and supporting garment accessories.",
    children: [
      "Zippers",
      "Buttons",
      "Interlining",
      "Motifs",
      "Velcro",
      "Elastic",
      "Cords",
      "Ribbons",
      "Toggles",
      "Rivets",
      "Hang Tags",
      "Polybags",
      "Elastic Tape",
      "Buttonhole Tape",
      "Welted Tape",
      "Fringes",
      "Tassels",
      "Other Accessories",
    ],
  },
];

export default function ProductCategoriesPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({
    garments: true,
    fabrics: true,
    "garment-accessories": true,
  });

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return CATEGORY_STRUCTURE;
    }

    return CATEGORY_STRUCTURE.map((division) => {
      const divisionMatch =
        division.name.toLowerCase().includes(query) ||
        division.description.toLowerCase().includes(query);

      const children = division.children.filter((child) =>
        child.toLowerCase().includes(query)
      );

      if (divisionMatch) {
        return division;
      }

      if (children.length > 0) {
        return {
          ...division,
          children,
        };
      }

      return null;
    }).filter(Boolean);
  }, [search]);

  const toggleDivision = (id) => {
    setExpanded((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <div className="categories-page">
      <PageHeader
        eyebrow="Product Master"
        title="Categories"
        description="Manage the product taxonomy used across garments, fabrics and garment accessories."
        action={
          <div className="categories-page__header-actions">
            <Link href="/products">
              <Button variant="secondary" icon={ArrowLeft}>
                Products
              </Button>
            </Link>

            <Button icon={Plus} disabled>
              Add Category
            </Button>
          </div>
        }
      />

      <div className="categories-page__notice">
        <div className="categories-page__notice-icon">
          <Settings2 size={17} strokeWidth={1.8} />
        </div>

        <div>
          <strong>Category management is backend-ready</strong>
          <p>
            The category structure is defined for the ERP. Create, edit and
            persistence actions will become active when the database and API
            layer are connected.
          </p>
        </div>
      </div>

      <div className="categories-page__stats">
        <Card className="categories-stat">
          <span className="categories-stat__label">Divisions</span>
          <strong>{CATEGORY_STRUCTURE.length}</strong>
          <span>Core product divisions</span>
        </Card>

        <Card className="categories-stat">
          <span className="categories-stat__label">Subcategories</span>
          <strong>
            {CATEGORY_STRUCTURE.reduce(
              (total, division) => total + division.children.length,
              0
            )}
          </strong>
          <span>Configured taxonomy</span>
        </Card>

        <Card className="categories-stat">
          <span className="categories-stat__label">Products</span>
          <strong>0</strong>
          <span>Awaiting database connection</span>
        </Card>
      </div>

      <Card
        title="Product Taxonomy"
        description="Your core product hierarchy for the ERP."
        className="categories-card"
      >
        <div className="categories-toolbar">
          <div className="categories-search">
            <Search size={17} strokeWidth={1.8} />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories..."
              aria-label="Search categories"
            />
          </div>

          <div className="categories-toolbar__status">
            <Badge variant="success">Active Structure</Badge>
          </div>
        </div>

        <div className="categories-tree">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((division) => {
              const isExpanded = expanded[division.id];

              return (
                <div
                  className="category-division"
                  key={division.id}
                >
                  <button
                    type="button"
                    className="category-division__header"
                    onClick={() => toggleDivision(division.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="category-division__left">
                      <span className="category-division__toggle">
                        {isExpanded ? (
                          <ChevronDown size={17} />
                        ) : (
                          <ChevronRight size={17} />
                        )}
                      </span>

                      <span className="category-division__icon">
                        <FolderTree size={18} strokeWidth={1.8} />
                      </span>

                      <span className="category-division__content">
                        <strong>{division.name}</strong>
                        <small>{division.description}</small>
                      </span>
                    </span>

                    <span className="category-division__meta">
                      <span>
                        {division.children.length} subcategories
                      </span>

                      <Badge variant="success">Active</Badge>
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="category-children">
                      {division.children.map((child, index) => (
                        <div
                          className="category-child"
                          key={`${division.id}-${child}`}
                        >
                          <span className="category-child__line" />

                          <span className="category-child__number">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <span className="category-child__name">
                            {child}
                          </span>

                          <span className="category-child__products">
                            0 products
                          </span>

                          <Badge variant="success">Active</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="categories-empty">
              <div className="categories-empty__icon">
                <Search size={20} />
              </div>

              <h3>No categories found</h3>

              <p>
                No category matches your current search.
              </p>

              <Button
                variant="secondary"
                onClick={() => setSearch("")}
              >
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}