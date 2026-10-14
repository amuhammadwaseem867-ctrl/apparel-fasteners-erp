/*
 * Fastener catalogue from the owner's requirements (config/items.js),
 * expanded into every distinct specification. Each entry is a separate
 * item: sizes, materials, types, finishes, variants and Logo/Plain are
 * never merged. This is reference data used to check which required
 * items exist in the item master; it carries no stock.
 */

import {
  RAW_MATERIAL_CATEGORIES,
  TEETH_SPECS,
  TOP_STOP_FINISHES,
  BOTTOM_FINISHES,
  PIN_BOX_FINISHES,
  TWO_PIN_FINISHES,
  SLIDER_SPECS,
} from "../../config/items.js";
import { suggestSku } from "./sku.js";

export const CATEGORY_LABELS = Object.fromEntries(
  RAW_MATERIAL_CATEGORIES.map((category) => [category.id, category.label]),
);

export function buildCatalog() {
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

  // SKUs come from the full specification (see sku.js). The previous
  // generator truncated finishes to six letters, so "Antique Silver",
  // "Antique Brass" and "Antique Copper" collapsed into one SKU.
  return items.map((item) => ({
    ...item,
    sku: suggestSku({
      category: CATEGORY_LABELS[item.category] ?? item.category,
      size: item.size,
      itemType: item.type,
      material: item.material,
      finish: item.finish,
      variant: item.variant,
      logoType: item.logo,
    }),
  }));
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase().replace(/^#/, "");
}

/*
 * True when an item-master product carries this catalogue specification.
 * Compared on category label, size, type, finish, variant and logo.
 */
export function matchesCatalogEntry(product, entry) {
  return norm(product.category) === norm(CATEGORY_LABELS[entry.category] ?? entry.category)
    && norm(product.size) === norm(entry.size)
    && norm(product.itemType) === norm(entry.type)
    && norm(product.finish) === norm(entry.finish)
    && norm(product.material) === norm(entry.material)
    && norm(product.variant) === norm(entry.variant)
    && norm(product.logoType) === norm(entry.logo);
}
