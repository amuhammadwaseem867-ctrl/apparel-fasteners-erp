"use client";

/*
 * The process bar on every order-process page (D-041): the seven steps
 * from order to payment, the step this page belongs to, and, when the
 * page shows one order's record, where that order is, what to do next and
 * what is blocking it. It reads the same APIs as the pages, so a user sees
 * only what their permissions allow.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import { PROCESS_STEPS, processSteps, recordForPath, stepForPath } from "@/lib/process/processSteps";

import "./ProcessNav.css";

/* Finds the sales order behind a detail page's record. */
async function salesOrderFor(record) {
  if (record.salesOrderId) return record.salesOrderId;
  let row = await apiRequest(record.api);
  if (row.salesOrderId) return row.salesOrderId;
  if (row.productionOrderId) {
    row = await apiRequest(`/api/production/orders/${row.productionOrderId}`);
    return row.salesOrderId ?? null;
  }
  if (row.shipmentId) {
    row = await apiRequest(`/api/dispatch/shipments/${row.shipmentId}`);
    return row.salesOrderId ?? null;
  }
  return null;
}

export default function ProcessNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageStep = stepForPath(pathname);
  const record = recordForPath(pathname, searchParams);
  const recordKey = record ? record.salesOrderId ?? record.api : "";
  const [state, setState] = useState({ key: "", trace: null });
  const [version, setVersion] = useState(0);

  // Reload after anything is saved on the page.
  useEffect(() => {
    const changed = () => setVersion((current) => current + 1);
    window.addEventListener("erp:data-changed", changed);
    return () => window.removeEventListener("erp:data-changed", changed);
  }, []);

  useEffect(() => {
    if (!recordKey) return undefined;
    let active = true;
    const current = recordForPath(pathname, searchParams);
    salesOrderFor(current)
      .then((id) => (id ? apiRequest(`/api/sales/orders/${id}/trace`) : null))
      .then((trace) => { if (active) setState({ key: recordKey, trace }); })
      // The page itself reports load errors; the bar then shows navigation only.
      .catch(() => { if (active) setState({ key: recordKey, trace: null }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordKey captures the path and query that matter
  }, [recordKey, version]);

  if (!pageStep) return null;
  const trace = state.key === recordKey ? state.trace : null;
  const flow = trace ? processSteps(trace) : null;
  const steps = flow?.steps ?? PROCESS_STEPS.map((step) => ({ ...step, state: "waiting" }));
  const profile = trace ? `/sales/orders/${trace.order.id}` : null;

  return (
    <nav className="pn" aria-label="Order process">
      <ol className="pn__steps">
        {steps.map((step, index) => (
          <li key={step.key} className={`pn__step pn__step--${step.state} ${step.key === pageStep ? "pn__step--here" : ""}`}>
            <Link href={profile ? `${profile}#step-${step.key}` : step.href} aria-current={step.key === pageStep ? "page" : undefined}>
              <span className="pn__dot">{step.state === "done" ? <Check size={12} strokeWidth={3} /> : index + 1}</span>
              <span className="pn__label">{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>
      {trace && (
        <div className={`pn__next ${flow.next?.blocker ? "pn__next--blocked" : flow.complete ? "pn__next--done" : ""}`} role="status">
          <span className="pn__order">
            Order <Link href={profile}>{trace.order.orderNumber}</Link> · {trace.status}
          </span>
          {flow.complete ? (
            <span><Check size={14} /> Every step is complete.</span>
          ) : flow.next?.blocker ? (
            <span><AlertTriangle size={14} /> <strong>Blocked at {flow.next.step.label}:</strong> {flow.next.blocker}{flow.next.href && <> <Link href={flow.next.href}>Open</Link></>}</span>
          ) : (
            <span><ArrowRight size={14} /> <strong>Next — {flow.next.step.label}:</strong> {flow.next.action}{flow.next.href && <> <Link href={flow.next.href}>Go</Link></>}</span>
          )}
        </div>
      )}
    </nav>
  );
}
