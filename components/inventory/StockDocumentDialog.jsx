"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ItemPicker from "@/components/inventory/ItemPicker";
import LocationSelect from "@/components/inventory/LocationSelect";
import { apiRequest } from "@/lib/api/client";
import { STOCK_DOCUMENT_TYPES } from "@/server/inventory/stock-rules";

/*
 * Posts one stock document (receipt, issue, transfer, adjustment, count,
 * QC hold/release/reject...) through POST /api/inventory/documents.
 *
 * The idempotency key is created when the dialog opens and reused for every
 * retry of the same submission, so a double click or a retry after a
 * network error can never post the stock twice. Success is shown only
 * after the server confirms; the server's error message is shown otherwise.
 */

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyLine() {
  return { key: newKey(), item: null, locationId: "", toLocationId: "", quantity: "" };
}

const QUANTITY_LABELS = {
  ADJUSTMENT: "Quantity (+ add / − remove)",
  COUNT: "Counted quantity",
};

export default function StockDocumentDialog({
  open,
  onClose,
  onPosted,
  documentType,
  allowedTypes,
  locations = [],
  initialLine,
}) {
  const types = allowedTypes ?? [documentType];
  const [type, setType] = useState(documentType ?? types[0]);
  const [lines, setLines] = useState(() => [{ ...emptyLine(), ...initialLine }]);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey] = useState(newKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState(null);

  const rule = STOCK_DOCUMENT_TYPES[type];
  const isTransfer = type === "TRANSFER";
  const needsReason = Boolean(rule?.requiresReason);

  const ready = useMemo(() => lines.every((line) =>
    line.item && line.locationId && line.quantity !== "" &&
    (!isTransfer || line.toLocationId)) && (!needsReason || reason.trim()),
  [lines, isTransfer, needsReason, reason]);

  function updateLine(key, patch) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting || !ready) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await apiRequest("/api/inventory/documents", {
        method: "POST",
        body: JSON.stringify({
          documentType: type,
          idempotencyKey,
          reference,
          reason,
          notes,
          lines: lines.map((line) => ({
            productId: line.item.id,
            locationId: line.locationId,
            ...(isTransfer ? { toLocationId: line.toLocationId } : {}),
            quantity: Number(line.quantity),
          })),
        }),
      });

      setPosted(result.document);
      onPosted?.(result.document);
    } catch (cause) {
      setError(cause?.message || "The transaction was not posted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (posted) {
    return (
      <Modal open={open} onClose={onClose} title={`${rule?.label} posted`} size="medium">
        <div className="inv-dialog">
          <p className="inv-dialog__success" role="status">
            Document <strong>{posted.documentNumber}</strong> was posted with{" "}
            {posted.movements.length} ledger {posted.movements.length === 1 ? "movement" : "movements"}.
          </p>
          <div className="inv-dialog__actions">
            <Link className="inv-link-button" href={`/print/stock-documents/${posted.id}`}>
              Print slip
            </Link>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={rule?.label ?? "Stock transaction"}
      description="Posted immediately to the stock ledger. Posted documents cannot be edited; correct them with a new transaction."
      size="large"
    >
      <form className="inv-dialog" onSubmit={submit}>
        {types.length > 1 && (
          <div className="inv-field">
            <label htmlFor="inv-doc-type">Transaction type *</label>
            <select id="inv-doc-type" value={type} onChange={(event) => setType(event.target.value)}>
              {types.map((key) => (
                <option key={key} value={key}>{STOCK_DOCUMENT_TYPES[key].label}</option>
              ))}
            </select>
          </div>
        )}

        {lines.map((line, index) => (
          <fieldset key={line.key} className="inv-dialog__line">
            <legend>Line {index + 1}</legend>
            <ItemPicker
              required
              value={line.item}
              onChange={(item) => updateLine(line.key, { item })}
            />
            <LocationSelect
              required
              label={isTransfer ? "From location" : "Location"}
              locations={locations}
              value={line.locationId}
              onChange={(locationId) => updateLine(line.key, { locationId })}
            />
            {isTransfer && (
              <LocationSelect
                required
                label="To location"
                locations={locations}
                exclude={line.locationId}
                value={line.toLocationId}
                onChange={(toLocationId) => updateLine(line.key, { toLocationId })}
              />
            )}
            <div className="inv-field">
              <label htmlFor={`qty-${line.key}`}>
                {QUANTITY_LABELS[type] ?? "Quantity"} *{line.item ? ` (${line.item.unit})` : ""}
              </label>
              <input
                id={`qty-${line.key}`}
                type="number"
                step="any"
                required
                min={type === "ADJUSTMENT" ? undefined : type === "COUNT" ? "0" : "0.000001"}
                value={line.quantity}
                onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
              />
            </div>
            {lines.length > 1 && (
              <button
                type="button"
                className="inv-text-button"
                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              >
                Remove line
              </button>
            )}
          </fieldset>
        ))}

        <button
          type="button"
          className="inv-text-button"
          onClick={() => setLines((current) => [...current, emptyLine()])}
          disabled={lines.length >= 50}
        >
          + Add line
        </button>

        <div className="inv-dialog__grid">
          <div className="inv-field">
            <label htmlFor="inv-doc-ref">Reference</label>
            <input id="inv-doc-ref" value={reference} maxLength={120} placeholder="PO, order or slip number" onChange={(event) => setReference(event.target.value)} />
          </div>
          <div className="inv-field">
            <label htmlFor="inv-doc-reason">Reason{needsReason ? " *" : ""}</label>
            <input id="inv-doc-reason" required={needsReason} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </div>
        </div>
        <div className="inv-field">
          <label htmlFor="inv-doc-notes">Notes</label>
          <textarea id="inv-doc-notes" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        {error && <p className="inv-dialog__error" role="alert">{error}</p>}

        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={!ready}>
            Post {rule?.label?.toLowerCase()}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
