"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Layers3,
  Plus,
  Search,
  Settings2,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";

import "./Variants.css";

const VARIANT_TYPES = [
  {
    id: "garments",
    name: "Garments",
    description: "Size and color based product variations.",
    attributes: ["Size", "Color"],
  },
  {
    id: "fabrics",
    name: "Fabrics",
    description: "Color and width based material variations.",
    attributes: ["Color", "Width"],
  },
  {
    id: "accessories",
    name: "Garment Accessories",
    description: "Size, color and finish based variations.",
    attributes: ["Size", "Color", "Finish"],
  },
];

export default function ProductVariantsPage() {
  const [search, setSearch] = useState("");

  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return VARIANT_TYPES;
    }

    return VARIANT_TYPES.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.attributes.some((attribute) =>
          attribute.toLowerCase().includes(query)
        )
    );
  }, [search]);

  return (
    <div className="variants-page">
      <PageHeader
        eyebrow="Product Master"
        title="Variants"
        description="Configure product variation attributes across garments, fabrics and garment accessories."
        action={
          <div className="variants-page__actions">
            <Link href="/products">
              <Button variant="secondary" icon={ArrowLeft}>
                Products
              </Button>
            </Link>

            <Button icon={Plus} disabled>
              Add Variant
            </Button>
          </div>
        }
      />

      <div className="variants-page__notice">
        <div className="variants-page__notice-icon">
          <Settings2 size={17} strokeWidth={1.8} />
        </div>

        <div>
          <strong>Variant data is waiting for the backend</strong>
          <p>
            Variant records, SKU generation and product associations will be
            loaded from the database once the API layer is connected.
          </p>
        </div>
      </div>

      <div className="variants-page__stats">
        <Card>
          <span>Variant Records</span>
          <strong>0</strong>
          <small>No database records yet</small>
        </Card>

        <Card>
          <span>Variant Types</span>
          <strong>{VARIANT_TYPES.length}</strong>
          <small>Configured product divisions</small>
        </Card>

        <Card>
          <span>Attributes</span>
          <strong>7</strong>
          <small>Available variation attributes</small>
        </Card>
      </div>

      <Card
        title="Variant Configuration"
        description="Variation rules prepared for the product master."
        className="variants-card"
      >
        <div className="variants-toolbar">
          <div className="variants-search">
            <Search size={17} strokeWidth={1.8} />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search variant types..."
              aria-label="Search variant types"
            />
          </div>

          <Badge variant="success">Backend Ready</Badge>
        </div>

        <div className="variants-grid">
          {filteredTypes.map((item) => (
            <article className="variant-type" key={item.id}>
              <div className="variant-type__top">
                <div className="variant-type__icon">
                  <Layers3 size={19} strokeWidth={1.8} />
                </div>

                <Badge variant="success">Active</Badge>
              </div>

              <h3>{item.name}</h3>

              <p>{item.description}</p>

              <div className="variant-type__attributes">
                {item.attributes.map((attribute) => (
                  <span key={attribute}>{attribute}</span>
                ))}
              </div>

              <div className="variant-type__footer">
                <span>Products</span>
                <strong>0</strong>
              </div>
            </article>
          ))}

          {filteredTypes.length === 0 && (
            <div className="variants-empty">
              <Search size={20} />

              <h3>No variant type found</h3>

              <p>
                Try another search term.
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