/*
 * The AF7 order flow as an animated graphic: seven steps from order to
 * payment, joined by a line that a light pulse travels along, lighting
 * each step in turn. Decorative only (aria-hidden); the same steps the
 * ERP's process bar uses. Motion stops for users who prefer less motion.
 */

import { ClipboardCheck, Factory, FileText, PackageCheck, ShoppingCart, Truck, Wallet } from "lucide-react";

import "./ProcessFlow.css";

export const FLOW_STEPS = [
  { icon: ShoppingCart, label: "Order", text: "Order sheet, PO, specification" },
  { icon: Factory, label: "Production", text: "Nine stages, kg to pieces" },
  { icon: ClipboardCheck, label: "Quality", text: "Check points at every stage" },
  { icon: PackageCheck, label: "Packing", text: "Cartons, bags, weights" },
  { icon: Truck, label: "Dispatch", text: "Shipment and gate pass" },
  { icon: FileText, label: "Invoice", text: "Sales tax invoice, GST" },
  { icon: Wallet, label: "Payment", text: "Receipts and balances" },
];

export default function ProcessFlow({ variant = "row" }) {
  return (
    <div className={`pf pf--${variant}`} aria-hidden="true" style={{ "--n": FLOW_STEPS.length }}>
      <span className="pf__rail"><span className="pf__pulse" /></span>
      <ol className="pf__steps">
        {FLOW_STEPS.map(({ icon: Icon, label, text }, index) => (
          <li key={label} className="pf__step" style={{ "--i": index }}>
            <span className="pf__node"><Icon size={variant === "column" ? 18 : 16} strokeWidth={1.9} /></span>
            <span className="pf__copy">
              <strong>{label}</strong>
              {variant === "column" && <small>{text}</small>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
