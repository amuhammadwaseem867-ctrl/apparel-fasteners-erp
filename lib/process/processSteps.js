/*
 * The order process, step by step (D-041, D-048): Invoice (approving it
 * makes the order) → Production → Quality check → Packing → Dispatch →
 * Payment. From an order's trace
 * (GET /api/sales/orders/[id]/trace) it works out which steps are done,
 * which one is next, what to do there, and what is blocking it. Pure, so
 * the same rules show on every page and are unit tested.
 */

export const PROCESS_STEPS = [
  { key: "order", label: "Invoice", href: "/finance/invoices" },
  { key: "production", label: "Production", href: "/production/orders" },
  { key: "qc", label: "Quality check", href: "/quality/inspections" },
  { key: "packing", label: "Packing", href: "/packing/orders" },
  { key: "dispatch", label: "Dispatch", href: "/dispatch/shipments" },
  { key: "payment", label: "Payment", href: "/finance/payments" },
];

/* Which step a page belongs to, from its path; null for pages outside the process. */
export function stepForPath(pathname) {
  if (/^\/sales\/(orders|customers)(\/|$)/.test(pathname) || /^\/finance\/invoices(\/|$)/.test(pathname)) return "order";
  if (/^\/production(\/|$)/.test(pathname)) return "production";
  if (/^\/quality(\/|$)/.test(pathname)) return "qc";
  if (/^\/packing(\/|$)/.test(pathname)) return "packing";
  if (/^\/dispatch(\/|$)/.test(pathname)) return "dispatch";
  if (/^\/finance\/(payments|receivables)(\/|$)/.test(pathname)) return "payment";
  return null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/* The record a detail page shows, so the bar can find its order. */
export function recordForPath(pathname, searchParams) {
  const match = (pattern) => pathname.match(new RegExp(`^${pattern}/(${UUID})(/|$)`, "i"))?.[1];
  const sales = match("/sales/orders");
  if (sales) return { salesOrderId: sales };
  const routes = [
    ["/production/orders", (id) => `/api/production/orders/${id}`],
    ["/quality/inspections", (id) => `/api/quality/inspections/${id}`],
    ["/packing/orders", (id) => `/api/packing/lists/${id}`],
    ["/dispatch/shipments", (id) => `/api/dispatch/shipments/${id}`],
    ["/dispatch/gate-passes", (id) => `/api/gate-passes/${id}`],
    ["/finance/invoices", (id) => `/api/finance/invoices/${id}`],
  ];
  for (const [prefix, api] of routes) {
    const id = match(prefix);
    if (id) return { api: api(id) };
  }
  const productionOrderId = searchParams?.get?.("productionOrderId");
  if (productionOrderId && new RegExp(`^${UUID}$`, "i").test(productionOrderId)) return { api: `/api/production/orders/${productionOrderId}` };
  return null;
}

const stageOf = (order, key) => order.stages?.find((stage) => stage.stageKey === key);
const stageDone = (order, key) => stageOf(order, key)?.status === "COMPLETED";

/* Steps with state "done" | "current" | "waiting", and the next action or blocker. */
export function processSteps(trace) {
  const { order, production = [], inspections = [], packingLists = [], shipments = [], invoices = [], money = {} } = trace;
  const profile = `/sales/orders/${order.id}`;
  const live = production.filter((item) => item.status !== "CANCELLED");
  const all = (key) => live.length > 0 && live.every((item) => stageDone(item, key));
  const any = (key) => live.some((item) => stageDone(item, key));
  const ready = (previousKey, key) => live.filter((item) => stageDone(item, previousKey) && !stageDone(item, key));
  const names = (items) => items.map((item) => item.orderNumber).join(", ");
  const issued = invoices.filter((invoice) => invoice.status === "ISSUED");

  const done = {
    order: order.status === "APPROVED",
    production: all("assembling"),
    qc: all("quality-check"),
    packing: all("packing"),
    dispatch: all("delivered"),
    payment: issued.length > 0 && Number(money.invoiced) > 0 && Number(money.outstanding) === 0,
  };

  // What to do at each step, or what stops it, when it is the next one.
  const guide = {
    order: () => {
      if (order.status === "CANCELLED") return { blocker: "This order is cancelled." };
      const draft = invoices.find((invoice) => invoice.status === "DRAFT");
      return draft
        ? { action: `Check invoice ${draft.invoiceNumber}, then press Approve invoice.`, href: `${profile}#step-invoice` }
        : { action: "Check the order sheet, then press Confirm order.", href: profile };
    },
    production: () => {
      if (live.length === 0) return { action: "Send the order to production.", href: profile };
      const held = live.filter((item) => item.status === "ON_HOLD");
      if (held.length) return { blocker: `On hold: ${names(held)}. Resume it on the production order.`, href: `/production/orders/${held[0].id}` };
      const failing = live.flatMap((item) => (item.stages ?? []).filter((stage) => stage.status === "IN_PROGRESS" && stage.checks?.points?.some((point) => point.result === "FAIL")).map((stage) => `${item.orderNumber} ${stage.label}`));
      if (failing.length) return { blocker: `Failed check at ${failing.join(", ")}. Fix it and check again.`, href: `${profile}#step-production` };
      const running = live.find((item) => !stageDone(item, "assembling"));
      const stage = running?.stages?.find((item) => item.status !== "COMPLETED");
      return { action: stage ? `${running.orderNumber}: ${stage.status === "IN_PROGRESS" ? "record the checks and complete" : "start"} ${stage.label}.` : "Complete the production stages.", href: `${profile}#step-production` };
    },
    // Every step is passed on the order page (D-047): the links go to its sections.
    qc: () => {
      const open = inspections.find((row) => row.status === "OPEN");
      if (open) return { action: `Approve QC inspection ${open.inspectionNumber}.`, href: `${profile}#step-qc` };
      const waiting = ready("assembling", "quality-check");
      return waiting.length
        ? { action: `Press Record QC for ${names(waiting)}, then complete the Quality Check stage.`, href: `${profile}#step-production` }
        : { blocker: "Waits for production to finish Assembling.", href: `${profile}#step-production` };
    },
    packing: () => {
      const waiting = ready("quality-check", "packing");
      const draft = packingLists.find((list) => list.status === "DRAFT");
      if (draft) return { action: `Pass packing list ${draft.packingNumber}.`, href: `${profile}#step-packing` };
      return waiting.length
        ? { action: `Make the packing list for ${names(waiting)} and pass it.`, href: `${profile}#step-production` }
        : { blocker: "Waits for QC approval.", href: `${profile}#step-qc` };
    },
    dispatch: () => {
      const draft = shipments.find((shipment) => !shipment.dispatchedAt && shipment.status !== "CANCELLED");
      if (draft) return { action: `Dispatch shipment ${draft.shipmentNumber}; its gate pass is made with it.`, href: `${profile}#step-dispatch` };
      return any("packing") || packingLists.some((list) => list.status === "CONFIRMED")
        ? { action: "Create the shipment for the packed goods.", href: `${profile}#step-dispatch` }
        : { blocker: "Waits for a confirmed packing list.", href: `${profile}#step-packing` };
    },
    payment: () => (issued.length
      ? { action: `Record the customer's payment (outstanding ${money.outstanding}).`, href: `${profile}#step-invoice` }
      : { blocker: "Waits for an issued invoice.", href: `${profile}#step-invoice` }),
  };

  const cancelled = order.status === "CANCELLED";
  const nextIndex = cancelled ? 0 : PROCESS_STEPS.findIndex((step) => !done[step.key]);
  const steps = PROCESS_STEPS.map((step, index) => ({
    ...step,
    state: !cancelled && done[step.key] ? "done" : index === nextIndex ? "current" : "waiting",
  }));
  const next = nextIndex === -1 ? null : { step: PROCESS_STEPS[nextIndex], ...guide[PROCESS_STEPS[nextIndex].key]() };
  return { steps, next, complete: nextIndex === -1 };
}
