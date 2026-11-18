/*
 * Order costing (D-055): the AF7 master costing sheet as code. For each
 * order line it works out tape (meters, rolls, kg) and brass; per zipper
 * gauge and end it adds wastage, the brass scrap that is recovered, and
 * every material's consumption and expense; the total less the recovered
 * scrap is the material cost of the order.
 *
 * Formulas (from "Master Sheet-Costing", with the owner's answers):
 *   size cm        = size (inches x 2.54)
 *   cut cm         = size cm + margin (#4.5: 3.5, #5: 4)
 *   meters         = cut cm x qty / 100;  rolls = meters / roll meters
 *   tape kg        = meters / tape meters per kg (#4.5: 90, #5: 75)
 *   teeth cm       = size cm - 0.5
 *   brass kg       = teeth cm / 100 x brass g per meter x qty / 1000
 *   open-end gap   = gap cm / 100 x brass g per meter x qty / 1000 (recovered)
 *   wastage kg     = 0.04 under 1,000 m; 0.2 from 1,000 to 2,000 m;
 *                    above, 0.1 kg per 1,000 m
 *   wasted rolls   = wastage kg / roll weight; wasted meters = rolls x roll m
 *   wasted brass   = wasted rolls x brass kg per roll
 *   wasted tape    = wasted meters / tape meters per kg
 *   scrap value    = (wasted brass + gap brass) x brass price x 65%
 *   items          = (required + wastage) x unit price: tape kg, dyeing per
 *                    meter, plating per meter (plated finishes), brass kg,
 *                    bottom stop (closed end), pin box set (open end) or
 *                    two-way pin box set and 2 sliders (2-way open end,
 *                    D-059), puller, 2 top stops per piece, packing
 *   material cost  = sum of items - scrap value
 * Invoices (D-060): an aluminium zipper's chain is bought ready-made, so
 * it is costed as chain meters x aluminium chain price per meter in place
 * of tape, dyeing, plating and brass (no brass scrap); a line "with
 * customer slider / puller" or "without slider" has no slider cost; a
 * chain roll (in meters, rolls, or auto-gap pieces) is chain only, with
 * no stops, sliders or packing. The customer's own chain roll costs us no
 * chain; a chain roll "for plating" is a plating job on the customer's
 * chain: plating only.
 * Pure functions: rates come in, numbers go out (rounded only for display).
 */

export type GaugeRates = {
  gauge: string;
  marginCm: number;
  rollMeters: number;
  tapeMetersPerKg: number;
  brassGramsPerMeter: number;
  rollWeightKg: number;
  brassKgPerRoll: number;
  openEndGapCm: number;
  tapePricePerKg: number;
  dyeingPerMeter: number;
  platingPerMeter: number;
  bottomStopPerPc: number;
  pinBoxSetPerPc: number;
  /* 2-way open end (D-059): its pin box set, in place of the one-way set. */
  twoWayPinBoxSetPerPc: number;
  /* Ready-made aluminium chain, per meter (D-060). */
  aluminiumChainPerMeter: number;
  topStopPerPc: number;
  pullerPerPc: number;
};

export type CostingRates = {
  brassPricePerKg: number;
  packingPerPc: number;
  scrapRecoveryPercent: number;
  teethDeductionCm: number;
  wastageSmallKg: number;
  wastageMediumKg: number;
  wastageLargeKgPer1000m: number;
  platedFinishes: string[];
  gauges: GaugeRates[];
};

/* The master sheet's "just material" prices and the owner's answers (2026-10-29). */
export const DEFAULT_COSTING_RATES: CostingRates = {
  brassPricePerKg: 3500,
  packingPerPc: 0.15,
  scrapRecoveryPercent: 65,
  teethDeductionCm: 0.5,
  wastageSmallKg: 0.04,
  wastageMediumKg: 0.2,
  wastageLargeKgPer1000m: 0.1,
  platedFinishes: ["antique", "nickel", "nickle", "nickal", "matte silver", "mate silver"],
  gauges: [
    {
      gauge: "4.5", marginCm: 3.5, rollMeters: 200, tapeMetersPerKg: 90, brassGramsPerMeter: 26.88, rollWeightKg: 7.6, brassKgPerRoll: 5.88,
      openEndGapCm: 4.5, tapePricePerKg: 487.5, dyeingPerMeter: 350 / 90, platingPerMeter: 4.873,
      bottomStopPerPc: 2.65 * 0.273, pinBoxSetPerPc: 2.677, twoWayPinBoxSetPerPc: 2.0969, aluminiumChainPerMeter: 61, topStopPerPc: 2.65 * 0.0943, pullerPerPc: 9,
    },
    {
      gauge: "5", marginCm: 4, rollMeters: 100, tapeMetersPerKg: 75, brassGramsPerMeter: 41.67, rollWeightKg: 5.5, brassKgPerRoll: 4.16,
      openEndGapCm: 4.5, tapePricePerKg: 244, dyeingPerMeter: 500 / 90, platingPerMeter: 4.873,
      bottomStopPerPc: 1.041, pinBoxSetPerPc: 2.677, twoWayPinBoxSetPerPc: 2.0969, aluminiumChainPerMeter: 61, topStopPerPc: 0.617, pullerPerPc: 31.4,
    },
  ],
};

export type CostingLineInput = {
  lineNo: number;
  productName: string;
  size: string | null;
  finish: string | null;
  quantity: number;
  /* Pcs (default), Mtr / Meter, or Roll. */
  unit?: string | null;
};

/* "#5 Metal Zipper", "4.5# Y-Cut", "No. 5" -> "5"; null when no gauge is named. */
export function gaugeOf(productName: string): string | null {
  const match = /#\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*#|\bno\.?\s*(\d+(?:\.\d+)?)/i.exec(productName);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? String(Number(value)) : null;
}

/* "24 Inch", "24\"", "60 cm", "12.5" (cm) -> centimeters; null when unreadable. */
export function sizeInCm(size: string | null): number | null {
  if (/^\s*#/.test(size ?? "")) return null; // "#5" is a gauge, not a size
  if (!size) return null;
  const match = /(\d+(?:\.\d+)?)\s*(inch(?:es)?|in\b|"|''|cm|mm)?/i.exec(size);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = (match[2] ?? "cm").toLowerCase();
  if (unit === "mm") return value / 10;
  return unit === "cm" ? value : value * 2.54;
}

export const isOpenEnd = (productName: string) => /open/i.test(productName);

/* "2 Way", "2-way", "Two Way": a two-way separating (open end) zipper with two sliders (D-059). */
export const isTwoWay = (productName: string) => /\b(2|two)[\s-]*way\b/i.test(productName);

export const isChainRoll = (productName: string) => /chain\s*-?\s*rolls?|long\s*chain/i.test(productName);
export const isAluminium = (productName: string) => /alumin/i.test(productName);
/* The customer gives the slider, or none goes on. */
export const hasNoSlider = (productName: string) => /customer('?s)?\s+(slider|puller|da\s+puller)|(without|withut|w\/o)\s+(slider|sider|puller)/i.test(productName)
  || (/\buse\s+af\b/i.test(productName) && !/\buse\s+af\b[^)]*(slider|puller)/i.test(productName));

/* The customer gives the chain roll: we add stops (and slider) only. */
/* "(Use AF Pin Box and Stopper)": only the parts named are ours, so the chain is ours only when named. */
const usesOnlyAfParts = (productName: string) => {
  const match = /\buse\s+af\b([^)]*)/i.exec(productName);
  return match ? !/chain/i.test(match[1]) : false;
};
export const hasCustomerChain = (productName: string) => usesOnlyAfParts(productName)
  || /customer('?s)?\b[^,;]*\bchain\s*-?\s*rolls?|chain\s*-?\s*rolls?\s+(from|of)\s+(the\s+)?customer/i.test(productName);
/* "Chain roll for plating", "Metal chain roll plating": we plate the customer's chain. */
export const isPlatingJob = (productName: string) => isChainRoll(productName) && /plating/i.test(productName);

export type ZipperEnd = "Open end" | "Close end" | "2-way open end" | "Chain roll";
export const endOf = (productName: string): ZipperEnd => (isChainRoll(productName) ? "Chain roll"
  : isTwoWay(productName) ? "2-way open end" : isOpenEnd(productName) ? "Open end" : "Close end");

const unitKind = (unit: string | null | undefined) => {
  const text = (unit ?? "").toLowerCase();
  if (/^(m|mtr|mtrs|meter|meters|metre|metres)\b/.test(text)) return "meter";
  if (/^rolls?\b/.test(text)) return "roll";
  return "piece";
};

export function isPlated(finish: string | null, rates: CostingRates) {
  const text = (finish ?? "").toLowerCase();
  return Boolean(text) && rates.platedFinishes.some((keyword) => keyword && text.includes(keyword.toLowerCase()));
}

/* The note's rule: 0.04 kg under 1,000 m, 0.2 kg to 2,000 m, then 0.1 kg per 1,000 m. */
export function wastageKg(meters: number, rates: CostingRates) {
  if (meters <= 0) return 0;
  if (meters < 1000) return rates.wastageSmallKg;
  if (meters <= 2000) return rates.wastageMediumKg;
  return (meters / 1000) * rates.wastageLargeKgPer1000m;
}

export type CostedLine = CostingLineInput & {
  gauge: string;
  end: ZipperEnd;
  material: "Brass" | "Aluminium";
  noSlider: boolean;
  /* What we put in: "full", the customer's chain ("no-chain"), or plating only. */
  chainSource: "full" | "no-chain" | "plating-only";
  /* Pieces, or meters for a chain roll sold by the meter or roll. */
  countUnit: "Pcs" | "Mtr";
  sizeCm: number;
  cutCm: number;
  meters: number;
  rolls: number;
  tapeKg: number;
  teethCm: number;
  brassGramsPerZipper: number;
  brassKg: number;
  gapBrassKg: number;
  plated: boolean;
};

export type CostItem = {
  key: string;
  name: string;
  unit: string;
  required: number;
  rejection: number;
  total: number;
  unitPrice: number;
  rejectionValue: number;
  expense: number;
  perPiece: number;
};

export type CostSection = {
  gauge: string;
  end: ZipperEnd;
  material: "Brass" | "Aluminium";
  countUnit: "Pcs" | "Mtr";
  chainSource: "full" | "no-chain" | "plating-only";
  customerSliders: number;
  pieces: number;
  meters: number;
  rolls: number;
  tapeKg: number;
  brassKg: number;
  lines: CostedLine[];
  wastage: { kg: number; rolls: number; meters: number; brassKg: number; tapeKg: number };
  scrap: { kg: number; value: number; perPiece: number };
  items: CostItem[];
  totalExpense: number;
  rejectionValue: number;
  materialCost: number;
  perPiece: number;
};

export type Skipped = { lineNo: number; productName: string; reason: string };

export function costLine(line: CostingLineInput, rates: CostingRates): { line?: CostedLine; skipped?: Skipped } {
  const gauge = gaugeOf(line.productName);
  const skip = (reason: string) => ({ skipped: { lineNo: line.lineNo, productName: line.productName, reason } });
  if (!gauge) return skip("No zipper gauge (#4.5, #5 ...) in the item name.");
  if (!/zip|chain/i.test(line.productName)) return skip("Not a zipper or chain roll (sliders, tape, pins are not costed).");
  const gaugeRates = rates.gauges.find((item) => item.gauge === gauge);
  if (!gaugeRates) return skip(`No costing rates for #${gauge}. Add them in Costing rates.`);
  if (!(line.quantity > 0)) return skip("No quantity.");
  const end = endOf(line.productName);
  const material = isAluminium(line.productName) ? "Aluminium" : "Brass";
  const kind = unitKind(line.unit);
  const chainSource = isPlatingJob(line.productName) ? "plating-only" : hasCustomerChain(line.productName) ? "no-chain" : "full";
  // A chain roll sold by the meter or roll: each meter is one "piece" of 100 cm, teeth all along.
  if (end === "Chain roll" && kind !== "piece") {
    const meters = kind === "roll" ? line.quantity * gaugeRates.rollMeters : line.quantity;
    return {
      line: {
        ...line, quantity: meters, gauge, end, material, noSlider: true, countUnit: "Mtr", chainSource,
        sizeCm: 100, cutCm: 100, meters, rolls: meters / gaugeRates.rollMeters,
        tapeKg: material === "Aluminium" ? 0 : meters / gaugeRates.tapeMetersPerKg,
        teethCm: 100, brassGramsPerZipper: material === "Aluminium" ? 0 : gaugeRates.brassGramsPerMeter,
        brassKg: material === "Aluminium" ? 0 : (meters * gaugeRates.brassGramsPerMeter) / 1000,
        gapBrassKg: 0, plated: chainSource === "plating-only" || (material === "Brass" && isPlated(line.finish, rates)),
      },
    };
  }
  const sizeCm = sizeInCm(line.size);
  if (!sizeCm) return skip("No size on the line.");
  const open = end === "Open end" || end === "2-way open end";
  const cutCm = sizeCm + gaugeRates.marginCm;
  const meters = (cutCm * line.quantity) / 100;
  const teethCm = sizeCm - rates.teethDeductionCm;
  const brassGramsPerZipper = material === "Aluminium" ? 0 : (teethCm / 100) * gaugeRates.brassGramsPerMeter;
  return {
    line: {
      ...line,
      gauge,
      end,
      material,
      noSlider: end === "Chain roll" || hasNoSlider(line.productName),
      chainSource,
      countUnit: "Pcs",
      sizeCm,
      cutCm,
      meters,
      rolls: meters / gaugeRates.rollMeters,
      tapeKg: material === "Aluminium" ? 0 : meters / gaugeRates.tapeMetersPerKg,
      teethCm,
      brassGramsPerZipper,
      brassKg: (brassGramsPerZipper * line.quantity) / 1000,
      gapBrassKg: open && material === "Brass" ? ((gaugeRates.openEndGapCm / 100) * gaugeRates.brassGramsPerMeter * line.quantity) / 1000 : 0,
      plated: chainSource === "plating-only" || (material === "Brass" && isPlated(line.finish, rates)),
    },
  };
}

function item(key: string, name: string, unit: string, required: number, rejection: number, unitPrice: number, pieces: number): CostItem {
  const total = required + rejection;
  const expense = total * unitPrice;
  return { key, name, unit, required, rejection, total, unitPrice, rejectionValue: rejection * unitPrice, expense, perPiece: pieces ? expense / pieces : 0 };
}

const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);

export function costSection(lines: CostedLine[], rates: CostingRates): CostSection {
  const { gauge, end, material, countUnit, chainSource } = lines[0];
  const g = rates.gauges.find((itemRates) => itemRates.gauge === gauge)!;
  const pieces = sum(lines, (line) => line.quantity);
  const meters = sum(lines, (line) => line.meters);
  const platedMeters = sum(lines.filter((line) => line.plated), (line) => line.meters);
  const tapeKg = sum(lines, (line) => line.tapeKg);
  const brassKg = sum(lines, (line) => line.brassKg);
  const gapBrassKg = sum(lines, (line) => line.gapBrassKg);

  const aluminium = material === "Aluminium";
  // Ready-made aluminium chain: no tape or brass wastage of ours (D-060).
  const kg = aluminium || chainSource !== "full" ? 0 : wastageKg(meters, rates);
  const wasteRolls = kg / g.rollWeightKg;
  const wasteMeters = wasteRolls * g.rollMeters;
  const wastage = { kg, rolls: wasteRolls, meters: wasteMeters, brassKg: wasteRolls * g.brassKgPerRoll, tapeKg: wasteMeters / g.tapeMetersPerKg };

  const scrapKg = chainSource === "full" ? wastage.brassKg + gapBrassKg : 0;
  const scrapValue = scrapKg * rates.brassPricePerKg * (rates.scrapRecoveryPercent / 100);

  const sliders = sum(lines.filter((line) => !line.noSlider), (line) => line.quantity * (end === "2-way open end" ? 2 : 1));
  const customerSliders = sum(lines.filter((line) => line.noSlider && end !== "Chain roll"), (line) => line.quantity);
  const chain = chainSource === "no-chain" ? []
    : chainSource === "plating-only" ? [item("plating", "Plating (customer's chain)", "Meter", meters, 0, g.platingPerMeter, pieces)]
    : aluminium
    ? [item("aluminium-chain", "Aluminium chain", "Meter", meters, 0, g.aluminiumChainPerMeter ?? 61, pieces)]
    : [
      item("tape", "Tape", "Kg", tapeKg, wastage.tapeKg, g.tapePricePerKg, pieces),
      item("dyeing", "Dyeing", "Meter", meters, wastage.meters, g.dyeingPerMeter, pieces),
      ...(platedMeters > 0 ? [item("plating", "Plating", "Meter", platedMeters, wastage.meters * (platedMeters / meters), g.platingPerMeter, pieces)] : []),
      item("brass", "Brass", "Kg", brassKg, wastage.brassKg + gapBrassKg, rates.brassPricePerKg, pieces),
    ];
  const components = end === "Chain roll" ? [] : [
    end === "2-way open end"
      ? item("two-way-pin-box", "Two-way pin box set", "Pcs", pieces, 0, g.twoWayPinBoxSetPerPc, pieces)
      : end === "Open end"
        ? item("pin-box", "Pin box set", "Pcs", pieces, 0, g.pinBoxSetPerPc, pieces)
        : item("bottom-stop", "Bottom stop", "Pcs", pieces, 0, g.bottomStopPerPc, pieces),
    ...(sliders > 0 ? [item("puller", end === "2-way open end" ? "Puller / slider (2 per piece)" : "Puller / slider", "Pcs", sliders, 0, g.pullerPerPc, pieces)] : []),
    item("top-stop", "Top stop (2 per piece)", "Pcs", pieces * 2, 0, g.topStopPerPc, pieces),
    item("packing", "Packing", "Pcs", pieces, 0, rates.packingPerPc, pieces),
  ];
  const items = [...chain, ...components];
  const totalExpense = sum(items, (row) => row.expense);
  const materialCost = totalExpense - scrapValue;
  return {
    gauge, end, material, countUnit, chainSource, customerSliders, pieces, meters, rolls: meters / g.rollMeters, tapeKg, brassKg, lines, wastage,
    scrap: { kg: scrapKg, value: scrapValue, perPiece: pieces ? scrapValue / pieces : 0 },
    items, totalExpense, rejectionValue: sum(items, (row) => row.rejectionValue), materialCost, perPiece: pieces ? materialCost / pieces : 0,
  };
}

/* The whole order: one section per gauge and end, as the master sheet has one sheet each. */
export function costOrder(lines: CostingLineInput[], rates: CostingRates, revenue: number) {
  const costed: CostedLine[] = [];
  const skipped: Skipped[] = [];
  for (const line of lines) {
    const result = costLine(line, rates);
    if (result.line) costed.push(result.line);
    if (result.skipped) skipped.push(result.skipped);
  }
  const groups = new Map<string, CostedLine[]>();
  for (const line of costed) {
    const key = `${line.gauge}|${line.end}|${line.material}|${line.countUnit}|${line.chainSource}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  const sections = [...groups.values()]
    .map((group) => costSection(group, rates))
    .sort((a, b) => Number(a.gauge) - Number(b.gauge) || a.end.localeCompare(b.end) || a.material.localeCompare(b.material));
  const pieces = sum(sections, (section) => section.pieces);
  const materialCost = sum(sections, (section) => section.materialCost);
  const profit = revenue - materialCost;
  return {
    sections,
    skipped,
    totals: {
      pieces,
      meters: sum(sections, (section) => section.meters),
      tapeKg: sum(sections, (section) => section.tapeKg + section.wastage.tapeKg),
      brassKg: sum(sections, (section) => section.brassKg + section.wastage.brassKg),
      totalExpense: sum(sections, (section) => section.totalExpense),
      scrapValue: sum(sections, (section) => section.scrap.value),
      materialCost,
      perPiece: pieces ? materialCost / pieces : 0,
      revenue,
      profit,
      marginPercent: revenue ? (profit / revenue) * 100 : 0,
    },
  };
}
