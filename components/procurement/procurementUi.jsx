"use client";

import ItemPicker from "@/components/inventory/ItemPicker";
import { formatAmount, newKey, today } from "@/components/finance/financeUi";

export { formatAmount, newKey, today };

const TONES = {
  DRAFT: "warning", SUBMITTED: "warning", OPEN: "warning", PARTIALLY_RECEIVED: "warning",
  APPROVED: "good", ORDERED: "good", AWARDED: "good", RECEIVED: "good", ACTIVE: "good", POSTED: "good",
  REJECTED: "danger", CANCELLED: "danger", VOIDED: "danger", INACTIVE: "danger",
  CLOSED: "",
};

export function ProcStatusBadge({ status }) {
  const tone = TONES[status] ?? "";
  const label = String(status ?? "").toLowerCase().replace(/_/g, " ");
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{label.charAt(0).toUpperCase() + label.slice(1)}</span>;
}

export function emptyLine(withPrice) {
  return { key: newKey(), item: null, quantity: "", ...(withPrice ? { unitPrice: "", discountPercent: "0", taxPercent: "0" } : {}) };
}

/*
 * Editable item lines (item, quantity and, for orders, price/discount/tax).
 * Amounts shown here are a preview; the server computes the stored totals.
 */
export function LinesEditor({ lines, onChange, withPrice = false, idPrefix = "ln" }) {
  const update = (key, patch) => onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  return (
    <div className="inv-lines">
      {lines.map((line, index) => (
        <div key={line.key} className="inv-dialog__grid" style={{ alignItems: "end", borderBottom: "1px solid var(--color-border, #e5e7eb)", paddingBottom: 8 }}>
          <ItemPicker label={`Item ${index + 1}`} required value={line.item} onChange={(item) => update(line.key, { item, ...(withPrice && item && !line.unitPrice ? { unitPrice: String(item.unitPrice ?? "") } : {}) })} />
          <div className="inv-field">
            <label htmlFor={`${idPrefix}-q-${line.key}`}>Quantity{line.item ? ` (${line.item.unit})` : ""} *</label>
            <input id={`${idPrefix}-q-${line.key}`} type="number" min="0" step="any" required value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} />
          </div>
          {withPrice && (
            <>
              <div className="inv-field">
                <label htmlFor={`${idPrefix}-p-${line.key}`}>Unit price *</label>
                <input id={`${idPrefix}-p-${line.key}`} type="number" min="0" step="any" required value={line.unitPrice} onChange={(event) => update(line.key, { unitPrice: event.target.value })} />
              </div>
              <div className="inv-field">
                <label htmlFor={`${idPrefix}-d-${line.key}`}>Disc %</label>
                <input id={`${idPrefix}-d-${line.key}`} type="number" min="0" max="100" step="1" value={line.discountPercent} onChange={(event) => update(line.key, { discountPercent: event.target.value })} />
              </div>
              <div className="inv-field">
                <label htmlFor={`${idPrefix}-t-${line.key}`}>Tax %</label>
                <input id={`${idPrefix}-t-${line.key}`} type="number" min="0" max="100" step="1" value={line.taxPercent} onChange={(event) => update(line.key, { taxPercent: event.target.value })} />
              </div>
            </>
          )}
          <div className="inv-field">
            <button type="button" className="inv-link-button" disabled={lines.length === 1} onClick={() => onChange(lines.filter((item) => item.key !== line.key))}>Remove</button>
          </div>
        </div>
      ))}
      <button type="button" className="inv-link-button" onClick={() => onChange([...lines, emptyLine(withPrice)])}>+ Add line</button>
    </div>
  );
}

export function linesPayload(lines, withPrice = false) {
  return lines.filter((line) => line.item).map((line) => ({
    productId: line.item.id,
    quantity: Number(line.quantity),
    ...(withPrice ? { unitPrice: Number(line.unitPrice), discountPercent: Number(line.discountPercent || 0), taxPercent: Number(line.taxPercent || 0) } : {}),
  }));
}

export function linesValid(lines, withPrice = false) {
  return lines.length > 0 && lines.every((line) => line.item && Number(line.quantity) > 0 && (!withPrice || (line.unitPrice !== "" && Number(line.unitPrice) >= 0)));
}

/* Supplier select fed by GET /api/procurement/suppliers?status=ACTIVE. */
export function SupplierSelect({ suppliers, value, onChange, id = "sup-select", label = "Supplier", required = true }) {
  return (
    <div className="inv-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <select id={id} required={required} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select supplier</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.name}</option>)}
      </select>
    </div>
  );
}
