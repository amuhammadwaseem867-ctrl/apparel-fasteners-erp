/**
 * Apparel Fastener ERP — Raw material / Item Master catalog.
 *
 * Every unique product specification stays INDEPENDENTLY
 * traceable — sizes, materials, types, finishes, colors,
 * variants and Logo/Plain configurations are never merged.
 */

export const RAW_MATERIAL_CATEGORIES = [
  { id: "teeth", label: "Teeth" },
  { id: "top-stops", label: "Top Stops" },
  { id: "bottom", label: "Bottom" },
  { id: "pin-box", label: "Pin Box" },
  { id: "two-pins", label: "Two Pins" },
  { id: "sliders", label: "Sliders" },
  { id: "tape", label: "Tape" },
  { id: "other-raw", label: "Other Raw Materials" },
  { id: "finished-goods", label: "Finished Goods" },
];

/**
 * Item Master field model (backend entity mirror).
 * {
 *   sku, itemName, category, subcategory, size, material, type,
 *   finish, color, variant, logoType, warehouse, location,
 *   minimumStock, currentStock, reservedStock, availableStock, wipStock
 * }
 */
export const ITEM_FIELDS = [
  "sku",
  "itemName",
  "category",
  "subcategory",
  "size",
  "material",
  "type",
  "finish",
  "color",
  "variant",
  "logoType",
  "warehouse",
  "location",
  "minimumStock",
  "currentStock",
  "reservedStock",
  "availableStock",
  "wipStock",
];

function spec(skuBase, size, material, type, extra = {}) {
  return {
    sku: skuBase,
    size,
    material,
    type,
    finish: extra.finish || null,
    color: extra.color || null,
    variant: extra.variant || null,
    logoType: extra.logoType || "Plain",
    category: extra.category || "teeth",
  };
}

export const TEETH_SPECS = [
  spec("TH-3-PL-BR", "#3", "Brass", "Plain"),
  spec("TH-45-BR", "#4.5", "Brass", "Plain"),
  spec("TH-5-PL-BR", "#5", "Brass", "Plain"),
  spec("TH-5-YC-BR", "#5", "Brass", "Y-Cut"),
  spec("TH-45-AL", "#4.5", "Aluminium", "Plain"),
  spec("TH-5-PL-AL", "#5", "Aluminium", "Plain"),
  spec("TH-5-YC-AL", "#5", "Aluminium", "Y-Cut"),
];

export const TOP_STOP_FINISHES = {
  "4.5": [
    "Antique Silver",
    "Antique Brass",
    "Golden Brass",
    "Shiny Silver",
    "Antique Copper",
    "Dull Silver",
    "Aluminium",
  ],
  "5": [
    "Antique Silver",
    "Antique Brass",
    "Golden Brass",
    "Gun Metal",
    "Shiny Silver",
    "Dull Silver",
    "Black Oxide",
    "Aluminium",
  ],
};

export const BOTTOM_FINISHES = {
  "4.5": [
    "Antique Silver",
    "Antique Brass",
    "Golden Brass",
    "Shiny Silver",
    "Antique Copper",
    "Dull Silver",
    "Aluminium",
  ],
  "5": [
    "Antique Silver",
    "Antique Brass",
    "Golden Brass",
    "Antique Copper",
    "Dull Silver",
    "Aluminium",
  ],
};

export const PIN_BOX_FINISHES = [
  "Antique Silver",
  "Antique Brass",
  "Golden Brass",
  "Gun Metal",
  "Shiny Silver",
  "Dull Silver",
  "Black Oxide",
];

export const TWO_PIN_FINISHES = ["Antique Silver", "Antique Brass", "Shiny Silver"];

export const SLIDER_SPECS = [
  // [sizeType, finish, variant, logo]
  ["#4.5 480", "Antique Silver", "Standard", ["Logo", "Plain"]],
  ["620 SS", "Antique Silver", "Standard", ["Logo", "Plain"]],
  ["#4.5 480", "Antique Brass", "Standard", ["Logo", "Plain"]],
  ["620 SS", "Antique Brass", "Standard", ["Logo", "Plain"]],
  ["#4.5 480", "Golden Brass", "Standard", ["Logo", "Plain"]],
  ["620 SS", "Golden Brass", "Standard", ["Logo", "Plain"]],
  ["#4.5 610 Brass", "Shiny Nickle", "Standard", ["Logo", "Plain"]],
  ["#4.5 470", "Shiny Nickle", "Standard", ["Plain"]],
  ["#4.5 470", "Dull Silver", "Standard", ["Plain"]],
  ["#3 DA", "Antique Silver", "DA Slider", ["Plain"]],
  ["#5 DA", "Antique Silver", "DA Slider", ["Plain"]],
  ["#5 DA", "Antique Brass", "DA Slider", ["Plain"]],
  ["#5 DA", "Gun Metal", "DA Slider", ["Plain"]],
  ["#5 DA", "Golden Brass", "DA Slider", ["Plain"]],
  ["#5 DA", "Shiny Silver", "DA Slider", ["Plain"]],
  ["#5 Thumb", "Antique Silver", "L", ["Plain"]],
  ["#5 Thumb", "Antique Silver", "S", ["Plain"]],
  ["#5 Thumb", "Antique Brass", "Standard", ["Plain"]],
  ["#5 Thumb", "Gun Metal", "Standard", ["Plain"]],
  ["#5 Thumb", "Shiny Silver", "Standard", ["Plain"]],
];

/**
 * Inventory movement types (warehouse transactions).
 */
export const MOVEMENT_TYPES = [
  { id: "goods-receipt", label: "Goods Receipt", direction: "in" },
  { id: "stock-in", label: "Stock In", direction: "in" },
  { id: "stock-out", label: "Stock Out", direction: "out" },
  { id: "material-issue", label: "Material Issue to Production", direction: "out" },
  { id: "material-return", label: "Material Return from Production", direction: "in" },
  { id: "stock-transfer", label: "Stock Transfer Between Warehouses", direction: "transfer" },
  { id: "stock-adjustment", label: "Stock Adjustment", direction: "adjust" },
  { id: "damaged-stock", label: "Damaged Stock", direction: "out" },
  { id: "rejected-stock", label: "Rejected Stock", direction: "out" },
  { id: "fg-receipt", label: "Finished Goods Receipt", direction: "in" },
  { id: "fg-dispatch", label: "Finished Goods Dispatch", direction: "out" },
  { id: "stock-reservation", label: "Stock Reservation Against Order", direction: "reserve" },
  { id: "stock-count", label: "Physical Stock Count", direction: "count" },
  { id: "stock-reconciliation", label: "Stock Reconciliation", direction: "adjust" },
];

/**
 * WIP tracking model — connects Inventory and Production.
 * Warehouse → Material Issue → Production → WIP → Next Stage → Finished Goods
 * {
 *   orderId, workOrderId, stageKey, itemId (sku),
 *   requiredQuantity, issuedQuantity, consumedQuantity,
 *   returnedQuantity, wastedQuantity, remainingQuantity
 * }
 */
export const WIP_FIELDS = [
  "requiredQuantity",
  "issuedQuantity",
  "consumedQuantity",
  "returnedQuantity",
  "wastedQuantity",
  "remainingQuantity",
];

export const UNITS = [
  "Pcs",
  "Meters",
  "Kgs",
  "Boxes",
  "Sets",
  "Gross",
];
