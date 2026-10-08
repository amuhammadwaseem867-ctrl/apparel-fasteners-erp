"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Filter,
  Plus,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

import {
  RAW_MATERIAL_CATEGORIES,
  TEETH_SPECS,
  TOP_STOP_FINISHES,
  BOTTOM_FINISHES,
  PIN_BOX_FINISHES,
  TWO_PIN_FINISHES,
  SLIDER_SPECS,
  UNITS,
} from "@/config/items";

import "./ItemMaster.css";

/*
 * Item Master — master catalog of raw material specifications.
 *
 * Every unique size / material / type / finish / color /
 * variant / Logo-Plain combination is a separate, traceable
 * item. The specifications below are static master data
 * (allowed configuration); stock quantities come from the
 * backend once connected.
 */

function buildCatalog() {
  const items = [];

  TEETH_SPECS.forEach((spec) => {
    items.push({
      sku: spec.sku,
      category: "teeth",
      name: `Teeth ${spec.size} ${spec.type} — ${spec.material}`,
      size: spec.size,
      material: spec.material,
      type: spec.type,
      finish: "",
      variant: "",
      logo: "",
    });
  });

  Object.entries(TOP_STOP_FINISHES).forEach(([size, finishes]) => {
    finishes.forEach((finish) => {
      items.push({
        sku: `TS-${size.replace(".", "")}-${finish.replace(/\s+/g, "").slice(0, 6).toUpperCase()}`,
        category: "top-stops",
        name: `Top Stop #${size} — ${finish}`,
        size: `#${size}`,
        material: "",
        type: "Top Stop",
        finish,
        variant: "",
        logo: "",
      });
    });
  });

  Object.entries(BOTTOM_FINISHES).forEach(([size, finishes]) => {
    finishes.forEach((finish) => {
      items.push({
        sku: `BT-${size.replace(".", "")}-${finish.replace(/\s+/g, "").slice(0, 6).toUpperCase()}`,
        category: "bottom",
        name: `Bottom #${size} — ${finish}`,
        size: `#${size}`,
        material: "",
        type: "Bottom",
        finish,
        variant: "",
        logo: "",
      });
    });
  });

  PIN_BOX_FINISHES.forEach((finish) => {
    items.push({
      sku: `PB-5-${finish.replace(/\s+/g, "").slice(0, 6).toUpperCase()}`,
      category: "pin-box",
      name: `Pin Box #5 — ${finish}`,
      size: "#5",
      material: "",
      type: "Pin Box",
      finish,
      variant: "",
      logo: "",
    });
  });

  TWO_PIN_FINISHES.forEach((finish) => {
    items.push({
      sku: `TP-${finish.replace(/\s+/g, "").slice(0, 6).toUpperCase()}`,
      category: "two-pins",
      name: `Two Pins — ${finish}`,
      size: "",
      material: "",
      type: "Two Pins",
      finish,
      variant: "",
      logo: "",
    });
  });

  SLIDER_SPECS.forEach(([sizeType, finish, variant, logos]) => {
    logos.forEach((logo) => {
      items.push({
        sku: `SL-${sizeType.replace(/[^\w]/g, "")}-${finish
          .replace(/\s+/g, "")
          .slice(0, 6)
          .toUpperCase()}-${logo.toUpperCase()}`,
        category: "sliders",
        name: `Slider ${sizeType} — ${finish} — ${variant} — ${logo}`,
        size: sizeType,
        material: "",
        type: "Slider",
        finish,
        variant,
        logo,
      });
    });
  });

  return items;
}

const CATALOG = buildCatalog();

export default function ItemMasterPage() {
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState("teeth");
  const [search, setSearch] = useState("");
  const [finishFilter, setFinishFilter] = useState("all");
  const [logoFilter, setLogoFilter] = useState("all");

  const items = useMemo(() => {
    return CATALOG.filter((item) => {
      if (item.category !== activeCategory) return false;

      if (finishFilter !== "all" && item.finish !== finishFilter) {
        return false;
      }

      if (logoFilter !== "all" && item.logo !== logoFilter) {
        return false;
      }

      if (search.trim()) {
        const value = search.trim().toLowerCase();

        const searchable = [
          item.sku,
          item.name,
          item.size,
          item.material,
          item.type,
          item.finish,
          item.variant,
          item.logo,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(value)) return false;
      }

      return true;
    });
  }, [activeCategory, search, finishFilter, logoFilter]);

  const finishOptions = useMemo(() => {
    const finishes = [
      ...new Set(
        CATALOG.filter((item) => item.category === activeCategory && item.finish)
          .map((item) => item.finish)
      ),
    ];

    return [
      { value: "all", label: "All Finishes" },
      ...finishes.map((finish) => ({ value: finish, label: finish })),
    ];
  }, [activeCategory]);

  const categoryLabel =
    RAW_MATERIAL_CATEGORIES.find((c) => c.id === activeCategory)?.label ||
    activeCategory;

  return (
    <main className="item-master">
      <PageHeader
        eyebrow="Materials & Inventory / Inventory"
        title="Item Master"
        description="Master catalog of raw materials. Every size, material, finish, color, variant and Logo/Plain combination is a separate traceable item."
        action={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() =>
              toast.info({
                title: "New item",
                message:
                  "Item creation opens once the inventory backend is connected.",
              })
            }
          >
            New Item
          </Button>
        }
      />

      <div className="item-master__content">
        {/* CATEGORY TABS */}
        <section className="item-master__tabs">
          {RAW_MATERIAL_CATEGORIES.map((category) => (
            <button
              className={`item-master__tab${
                activeCategory === category.id
                  ? " item-master__tab--active"
                  : ""
              }`}
              key={category.id}
              type="button"
              onClick={() => {
                setActiveCategory(category.id);
                setFinishFilter("all");
                setLogoFilter("all");
              }}
            >
              {category.label}
            </button>
          ))}
        </section>

        {/* TOOLBAR */}
        <section className="item-master__toolbar">
          <div className="item-master__search">
            <Input
              placeholder="Search by SKU, item name, size, material, type, finish, color, variant..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="item-master__filters">
            <Select
              value={finishFilter}
              onChange={setFinishFilter}
              options={finishOptions}
              fullWidth={false}
            />

            <Select
              value={logoFilter}
              onChange={setLogoFilter}
              options={[
                { value: "all", label: "Logo / Plain: All" },
                { value: "Logo", label: "Logo" },
                { value: "Plain", label: "Plain" },
              ]}
              fullWidth={false}
            />

            {(search || finishFilter !== "all" || logoFilter !== "all") && (
              <Button
                variant="secondary"
                icon={Filter}
                onClick={() => {
                  setSearch("");
                  setFinishFilter("all");
                  setLogoFilter("all");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </section>

        {/* ITEMS */}
        <section className="item-master__list-card">
          {items.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No matching items"
              description={
                search || finishFilter !== "all" || logoFilter !== "all"
                  ? "No items match the current filters in this category."
                  : "This category has no items defined."
              }
              action={
                search || finishFilter !== "all" || logoFilter !== "all" ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setFinishFilter("all");
                      setLogoFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="item-master__table-wrap">
              <table className="item-master__table">
                <thead>
                  <tr>
                    <th>SKU / Item Code</th>
                    <th>Item Name</th>
                    <th>Size</th>
                    <th>Material</th>
                    <th>Type</th>
                    <th>Finish</th>
                    <th>Variant</th>
                    <th>Logo / Plain</th>
                    <th>Stock Status</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.sku}>
                      <td>
                        <Link
                          href={`/inventory/item-master/${item.sku}`}
                          className="item-master__sku-link"
                        >
                          {item.sku}
                        </Link>
                      </td>

                      <td>{item.name}</td>
                      <td>{item.size || "—"}</td>
                      <td>{item.material || "—"}</td>
                      <td>{item.type}</td>
                      <td>{item.finish || "—"}</td>
                      <td>{item.variant || "—"}</td>
                      <td>{item.logo || "—"}</td>

                      <td>
                        <Badge variant="neutral">Backend</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="item-master__count">
            {items.length} specification{items.length === 1 ? "" : "s"} in{" "}
            {categoryLabel}
          </div>
        </section>
      </div>
    </main>
  );
}
