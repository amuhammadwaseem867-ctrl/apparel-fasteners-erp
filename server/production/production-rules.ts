/*
 * Production rules that need no database (see D-021).
 *
 * Per stage, in the production order's unit (no blockers, D-048):
 *   received  = the order quantity, whatever the stage before it has done
 *   processed = accepted + rejected + wastage + rework
 *   available = received + rework - processed
 * A run must satisfy input = accepted + rejected + wastage + rework and
 * input <= available, so a stage never processes more than the order.
 * Rework units go back into the same stage's queue. A stage can be
 * completed at any time; the order then moves to the next stage.
 *
 * Tape is weighed, not counted: when a production order carries tapeKg,
 * Tape Dyeing and Tape Press each receive that many kilograms. Teeth
 * Making onwards count the order quantity (pieces). Orders without tapeKg
 * keep every stage in the order's unit.
 */

import { PRODUCTION_STAGES } from "../../config/production.js";
import {
  addDecimalStrings,
  compareDecimalStrings,
  decimalSign,
  normalizeDecimalString,
  subtractDecimalStrings,
} from "../core/utils/decimal";

export const STAGES = PRODUCTION_STAGES.map((stage: { key: string; sequence: number; label: string; department: string }) => ({
  key: stage.key,
  sequence: stage.sequence,
  label: stage.label,
  department: stage.department,
}));

export const FINAL_STAGE = STAGES[STAGES.length - 1];

/* Stages measured in kilograms when the order carries a tape weight. */
export const TAPE_STAGE_KEYS = ["tape-dyeing", "tape-press"];
const TAPE_SEQUENCES = new Set(STAGES.filter((stage) => TAPE_STAGE_KEYS.includes(stage.key)).map((stage) => stage.sequence));

export function stageInKg(sequence: number, tapeKg?: string | null) {
  return Boolean(tapeKg && decimalSign(tapeKg) > 0) && TAPE_SEQUENCES.has(sequence);
}

export interface StageTotals {
  sequence: number;
  status: string;
  processedQuantity: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  wastageQuantity: string;
  reworkQuantity: string;
}

export interface RunInput {
  inputQuantity: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  wastageQuantity: string;
  reworkQuantity: string;
}

export function stageQuantities(stages: StageTotals[], orderQuantity: string, sequence: number, tapeKg?: string | null) {
  const stage = stages.find((item) => item.sequence === sequence);
  const previous = stages.find((item) => item.sequence === sequence - 1);

  if (!stage) {
    throw new RangeError(`Unknown stage sequence ${sequence}`);
  }

  // No blockers (D-048): every stage can take the whole order (the tape
  // weight for the kg stages) whenever it is worked, whatever the stage
  // before it has done. A stage still never processes more than that.
  const inKg = stageInKg(sequence, tapeKg);
  const received = inKg ? String(tapeKg) : orderQuantity;
  const available = subtractDecimalStrings(addDecimalStrings(received, stage.reworkQuantity), stage.processedQuantity);

  return {
    received: normalizeDecimalString(received),
    available: normalizeDecimalString(available),
    previousCompleted: sequence === 1 || previous?.status === "COMPLETED",
    inKg,
  };
}

/* Returns an error message, or null when the run is valid. */
/* Production order statuses that still accept work (D-053). */
export const WORKING_ORDER_STATUSES = ["RELEASED", "IN_PROGRESS", "COMPLETED"];

export function runError(
  run: RunInput,
  context: { available: string; stageStatus: string; orderStatus: string },
): string | null {
  // A completed stage or order still takes later work (D-053): the rest of
  // a part delivery is packed, checked and delivered after "Complete" was
  // pressed. Only a planned, held or cancelled order refuses output.
  if (!WORKING_ORDER_STATUSES.includes(context.orderStatus)) {
    return `Stage output cannot be recorded while the order is ${context.orderStatus.toLowerCase().replace("_", " ")}.`;
  }

  for (const [field, value] of Object.entries(run)) {
    if (decimalSign(value) < 0) {
      return `${field} cannot be negative.`;
    }
  }

  if (decimalSign(run.inputQuantity) <= 0) {
    return "Input quantity must be greater than zero.";
  }

  const total = [run.acceptedQuantity, run.rejectedQuantity, run.wastageQuantity, run.reworkQuantity]
    .reduce((sum, value) => addDecimalStrings(sum, value), "0");

  if (compareDecimalStrings(total, run.inputQuantity) !== 0) {
    return `Accepted + rejected + wastage + rework (${normalizeDecimalString(total)}) must equal the input quantity (${normalizeDecimalString(run.inputQuantity)}).`;
  }

  if (compareDecimalStrings(run.inputQuantity, context.available) > 0) {
    return `Only ${normalizeDecimalString(context.available)} is available at this stage.`;
  }

  return null;
}

/* A stage can be completed at any time (D-048); only a completed one cannot be completed again. */
export function completionError(
  _quantities: { available: string; previousCompleted: boolean },
  stageStatus: string,
): string | null {
  if (stageStatus === "COMPLETED") return "This stage is already completed.";
  return null;
}

/* Order status transitions triggered by an explicit action. */
const TRANSITIONS: Record<string, Record<string, string>> = {
  release: { PLANNED: "RELEASED" },
  hold: { RELEASED: "ON_HOLD", IN_PROGRESS: "ON_HOLD" },
  cancel: { PLANNED: "CANCELLED", RELEASED: "CANCELLED" },
};

export function nextOrderStatus(action: string, from: string, holdFromStatus?: string | null): string | null {
  if (action === "resume") {
    return from === "ON_HOLD" ? holdFromStatus ?? "RELEASED" : null;
  }
  return TRANSITIONS[action]?.[from] ?? null;
}

/* Completed stages / total stages, as a whole percentage. */
export function stageProgress(stages: Array<{ status: string }>): number {
  if (!stages.length) return 0;
  return Math.round((stages.filter((stage) => stage.status === "COMPLETED").length / stages.length) * 100);
}
