/*
 * MRP calculation, pure and deterministic (no database access).
 *
 * Conventions:
 * - Quantities are exact decimal strings (server/core/utils/decimal).
 * - BOM line quantity is per ONE parent unit, in the component's unit.
 * - Scrap is applied exactly once, on explosion of the line:
 *     component gross += planned parent quantity x line quantity
 *                        x (1 + scrapPercent / 100)
 * - Items are processed by low-level code (deepest BOM position), so every
 *   item's total gross requirement from all parents is known before it is
 *   netted, and its stock is netted exactly once.
 * - net = max(0, gross - allocated - available), where `allocated` is stock
 *   already reserved for the demand being planned and `available` is
 *   unreserved, non-held stock. Reserved-for-others and quality-held stock
 *   never count as supply.
 * - The planned quantity is net rounded UP to the item's unit precision.
 * - Items with an active BOM are MAKE; all others are BUY.
 */

import {
  addDecimalStrings,
  ceilDecimalString,
  compareDecimalStrings,
  decimalSign,
  multiplyDecimalStrings,
  normalizeDecimalString,
  subtractDecimalStrings,
} from "../core/utils/decimal";

export interface BomDefinition {
  bomId: string;
  revision: number;
  lines: Array<{ componentId: string; quantity: string; scrapPercent: string }>;
}

export interface MrpInput {
  /** Gross demand per item (e.g. approved order lines), summed. */
  demand: Map<string, string>;
  /** Active BOM per parent item. */
  boms: Map<string, BomDefinition>;
  /** Stock reserved for the planned demand, per item. */
  allocated: Map<string, string>;
  /** Unreserved, non-held stock per item. */
  available: Map<string, string>;
  /** Decimal places allowed for each item's unit. */
  unitDecimals: Map<string, number>;
}

export interface MrpRequirementResult {
  productId: string;
  lowLevelCode: number;
  grossRequirement: string;
  allocatedStock: string;
  availableStock: string;
  netRequirement: string;
  plannedQuantity: string;
  supplyType: "MAKE" | "BUY";
  bomId: string | null;
  bomRevision: number | null;
}

export class BomCycleError extends Error {
  readonly path: string[];

  constructor(path: string[]) {
    super(`BOM cycle: ${path.join(" -> ")}`);
    this.name = "BomCycleError";
    this.path = path;
  }
}

/*
 * Returns the cycle path if the graph (parent -> components) contains one,
 * otherwise null.
 */
export function findBomCycle(graph: Map<string, string[]>): string[] | null {
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(node: string): string[] | null {
    if (state.get(node) === "done") return null;
    if (state.get(node) === "visiting") {
      return [...stack.slice(stack.indexOf(node)), node];
    }

    state.set(node, "visiting");
    stack.push(node);

    for (const child of graph.get(node) ?? []) {
      const cycle = visit(child);
      if (cycle) return cycle;
    }

    stack.pop();
    state.set(node, "done");
    return null;
  }

  for (const node of [...graph.keys()].sort()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }

  return null;
}

/* Deepest position of every item in the BOM graph (0 = top level). */
export function lowLevelCodes(graph: Map<string, string[]>, items: Iterable<string>): Map<string, number> {
  const cycle = findBomCycle(graph);
  if (cycle) throw new BomCycleError(cycle);

  const codes = new Map<string, number>();

  function assign(node: string, level: number) {
    if ((codes.get(node) ?? -1) >= level) return;
    codes.set(node, level);
    for (const child of graph.get(node) ?? []) assign(child, level + 1);
  }

  for (const item of items) assign(item, 0);
  return codes;
}

function max0(value: string): string {
  return decimalSign(value) > 0 ? normalizeDecimalString(value) : "0";
}

function min(a: string, b: string): string {
  return compareDecimalStrings(a, b) <= 0 ? a : b;
}

export function calculateMrp(input: MrpInput): MrpRequirementResult[] {
  const graph = new Map<string, string[]>(
    [...input.boms.entries()].map(([parent, bom]) => [parent, bom.lines.map((line) => line.componentId)]),
  );
  const codes = lowLevelCodes(graph, [...input.demand.keys()].sort());
  const gross = new Map<string, string>(input.demand);
  const results: MrpRequirementResult[] = [];

  const levels = [...new Set(codes.values())].sort((a, b) => a - b);

  for (const level of levels) {
    const items = [...codes.entries()]
      .filter(([, code]) => code === level)
      .map(([item]) => item)
      .sort();

    for (const productId of items) {
      const required = gross.get(productId);
      if (!required || decimalSign(required) <= 0) continue;

      const allocated = input.allocated.get(productId) ?? "0";
      const available = input.available.get(productId) ?? "0";
      const usedAllocated = min(allocated, required);
      const afterAllocated = max0(subtractDecimalStrings(required, usedAllocated));
      const net = max0(subtractDecimalStrings(afterAllocated, available));
      const planned = decimalSign(net) > 0
        ? ceilDecimalString(net, input.unitDecimals.get(productId) ?? 3)
        : "0";
      const bom = input.boms.get(productId);

      if (bom && decimalSign(planned) > 0) {
        for (const line of bom.lines) {
          const factor = addDecimalStrings("1", multiplyDecimalStrings(line.scrapPercent, "0.01"));
          const componentGross = multiplyDecimalStrings(multiplyDecimalStrings(planned, line.quantity), factor);
          gross.set(line.componentId, addDecimalStrings(gross.get(line.componentId) ?? "0", componentGross));
        }
      }

      results.push({
        productId,
        lowLevelCode: level,
        grossRequirement: normalizeDecimalString(required),
        allocatedStock: normalizeDecimalString(usedAllocated),
        availableStock: normalizeDecimalString(available),
        netRequirement: net,
        plannedQuantity: planned,
        supplyType: bom ? "MAKE" : "BUY",
        bomId: bom?.bomId ?? null,
        bomRevision: bom?.revision ?? null,
      });
    }
  }

  return results;
}
