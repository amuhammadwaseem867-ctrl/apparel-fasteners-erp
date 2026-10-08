/**
 * Apparel Fastener ERP — Order domain configuration.
 *
 * Exact order statuses (do not extend without backend support).
 */

export const ORDER_STATUSES = [
  { id: "new", label: "New" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in-production", label: "In Production" },
  { id: "on-hold", label: "On Hold" },
  { id: "qc-pending", label: "QC Pending" },
  { id: "qc-approved", label: "QC Approved" },
  { id: "packing", label: "Packing" },
  { id: "ready-for-delivery", label: "Ready for Delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export function getOrderStatusLabel(id) {
  return ORDER_STATUSES.find((s) => s.id === id)?.label || id || "—";
}

export const PRODUCTION_PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

export const DELIVERY_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "scheduled", label: "Scheduled" },
  { id: "dispatched", label: "Dispatched" },
  { id: "in-transit", label: "In Transit" },
  { id: "delivered", label: "Delivered" },
];

export const RESPONSIBLE_DEPARTMENTS = [
  { id: "sales", label: "Sales / Order Management" },
  { id: "production", label: "Production" },
  { id: "quality", label: "Quality Control" },
  { id: "packing", label: "Packing" },
  { id: "dispatch", label: "Dispatch & Logistics" },
];

/**
 * Order attachments (backend-ready; no external storage yet).
 * Attachment record shape:
 * { id, orderId, type, name, uploadedBy, uploadedAt, note }
 */
export const ORDER_ATTACHMENT_TYPES = [
  { id: "purchase-order", label: "Purchase Order" },
  { id: "order-sheet", label: "Order Sheet" },
  { id: "specification", label: "Specification" },
  { id: "artwork", label: "Artwork / Logo" },
  { id: "packing-instructions", label: "Packing Instructions" },
  { id: "other", label: "Other Documents" },
];

/**
 * The order field model shared by the order form and the
 * order profile / traceability screen. Backend entity mirror.
 */
export const ORDER_FIELDS = {
  orderNumber: "Order Number / ID",
  customerName: "Customer Name",
  customerCode: "Customer Code",
  orderDate: "Order Date",
  requiredDeliveryDate: "Required Delivery Date",
  zipperType: "Product / Zipper Type",
  zipperSize: "Zipper Size",
  material: "Material",
  colorFinish: "Color / Finish",
  logoType: "Logo / Plain",
  requiredQuantity: "Required Quantity",
  unit: "Unit",
  productionPriority: "Production Priority",
  currentStage: "Current Production Phase",
  status: "Overall Order Status",
  responsibleDepartment: "Responsible Department",
  productionStartDate: "Production Start Date",
  expectedCompletionDate: "Expected Completion Date",
  actualCompletionDate: "Actual Completion Date",
  deliveryStatus: "Delivery Status",
  remarks: "Remarks / Special Instructions",
};

export const ZIPPER_SIZES = ["#3", "#4.5", "#5", "#8", "#10"];

export const ZIPPER_TYPES = [
  "Metal Zipper",
  "Nylon Zipper",
  "Plastic / Vislon Zipper",
  "Hidden / Invisible Zipper",
  "Two-Way Zipper",
  "Custom / Other",
];

export const MATERIALS = ["Brass", "Aluminium", "Nylon", "Plastic", "Other"];

export const COLOR_FINISHES = [
  "Antique Silver",
  "Antique Brass",
  "Golden Brass",
  "Gun Metal",
  "Shiny Silver",
  "Shiny Nickle",
  "Dull Silver",
  "Black Oxide",
  "Antique Copper",
  "Aluminium",
  "Other",
];

export const LOGO_TYPES = [
  { id: "plain", label: "Plain" },
  { id: "logo", label: "Logo" },
];
