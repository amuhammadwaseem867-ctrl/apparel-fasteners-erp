/**
 * Apparel Fastener ERP — Production stage configuration.
 *
 * The factory production flow for zippers / apparel fasteners.
 * Every production stage record (backend entity) is expected to
 * follow this shape (backend-ready, no DB implemented yet):
 *
 * {
 *   orderId,
 *   stageType,           // one of PRODUCTION_STAGES[].key
 *   sequence,
 *   status,
 *   inputQuantity,
 *   completedQuantity,
 *   rejectedQuantity,
 *   wastageQuantity,
 *   remainingQuantity,   // input - completed - rejected - wastage
 *   startedAt,
 *   completedAt,
 *   responsibleUserId,
 *   departmentId,
 *   remarks
 * }
 */

export const PRODUCTION_STAGES = [
  {
    key: "tape-dyeing",
    sequence: 1,
    label: "Tape Dyeing",
    description: "Tape dyeing and colour preparation",
    department: "Production",
  },
  {
    key: "tape-press",
    sequence: 2,
    label: "Tape Press",
    description: "Pressing and dimensional shaping",
    department: "Production",
  },
  {
    key: "teeth-making",
    sequence: 3,
    label: "Teeth Making",
    description: "Teeth production and forming",
    department: "Production",
  },
  {
    key: "plating",
    sequence: 4,
    label: "Plating",
    description: "Metal finishing and coating",
    department: "Production",
  },
  {
    key: "lacquer-wax",
    sequence: 5,
    label: "Lacquer & Wax",
    description: "Protective lacquer and wax coating",
    department: "Production",
  },
  {
    key: "assembling",
    sequence: 6,
    label: "Assembling",
    description: "Slider and component assembly",
    department: "Production",
  },
  {
    key: "quality-check",
    sequence: 7,
    label: "Quality Check",
    description: "Final quality inspection",
    department: "Quality Control",
  },
  {
    key: "packing",
    sequence: 8,
    label: "Packing",
    description: "Packing and documentation",
    department: "Packing",
  },
  {
    key: "delivered",
    sequence: 9,
    label: "Delivered",
    description: "Dispatched and delivered to customer",
    department: "Dispatch & Logistics",
  },
];

export const STAGE_KEYS = PRODUCTION_STAGES.map((stage) => stage.key);

export function getStage(key) {
  return PRODUCTION_STAGES.find((stage) => stage.key === key) || null;
}

export function getStageLabel(key) {
  return getStage(key)?.label || key || "—";
}

/**
 * Stage-level statuses used on the Stage Board and
 * per-stage records on the Order Profile.
 */
export const STAGE_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "ready", label: "Ready" },
  { id: "in-progress", label: "In Progress" },
  { id: "paused", label: "Paused / On Hold" },
  { id: "delayed", label: "Delayed" },
  { id: "completed", label: "Completed" },
];

/**
 * Compute remaining quantity from the other stage quantities.
 * remaining = input - completed - rejected - wastage
 */
export function computeRemaining({
  inputQuantity = 0,
  completedQuantity = 0,
  rejectedQuantity = 0,
  wastageQuantity = 0,
}) {
  return Math.max(
    0,
    Number(inputQuantity) -
    Number(completedQuantity) -
    Number(rejectedQuantity) -
    Number(wastageQuantity)
  );
}
