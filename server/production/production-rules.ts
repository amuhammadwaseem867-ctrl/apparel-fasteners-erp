/*
 * Production rules that need no database (see D-021).
 *
 * Per stage, in the production order's unit:
 *   received  = order quantity for stage 1, otherwise the accepted output
 *               of the previous stage
 *   processed = accepted + rejected + wastage + rework
 *   available = received + rework - processed
 * A run must satisfy input = accepted + rejected + wastage + rework and
 * input <= available. Rework units go back into the same stage's queue.
 * A stage completes when the previous stage is complete and nothing is
 * left in its queue; the order then moves to the next stage.
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

export function stageQuantities(stages: StageTotals[], orderQuantity: string, sequence: number) {
  const stage = stages.find((item) => item.sequence === sequence);
  const previous = stages.find((item) => item.sequence === sequence - 1);

  if (!stage) {
    throw new RangeError(`Unknown stage sequence ${sequence}`);
  }

  const received = sequence === 1 ? orderQuantity : previous?.acceptedQuantity ?? "0";
  const available = subtractDecimalStrings(addDecimalStrings(received, stage.reworkQuantity), stage.processedQuantity);

  return {
    received: normalizeDecimalString(received),
    available: normalizeDecimalString(available),
    previousCompleted: sequence === 1 || previous?.status === "COMPLETED",
  };
}

/* Returns an error message, or null when the run is valid. */
export function runError(
  run: RunInput,
  context: { available: string; stageStatus: string; orderStatus: string },
): string | null {
  if (!["RELEASED", "IN_PROGRESS"].includes(context.orderStatus)) {
    return `Stage output cannot be recorded while the order is ${context.orderStatus.toLowerCase().replace("_", " ")}.`;
  }

  if (context.stageStatus === "COMPLETED") {
    return "This stage is already completed.";
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

export function completionError(
  quantities: { available: string; previousCompleted: boolean },
  stageStatus: string,
): string | null {
  if (stageStatus === "COMPLETED") return "This stage is already completed.";
  if (!quantities.previousCompleted) return "The previous stage must be completed first.";
  if (decimalSign(quantities.available) !== 0) {
    return `${quantities.available} is still waiting to be processed at this stage.`;
  }
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
