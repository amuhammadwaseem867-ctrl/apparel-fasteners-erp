"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ItemPicker from "@/components/inventory/ItemPicker";
import LocationSelect from "@/components/inventory/LocationSelect";
import { PRODUCTION_STAGES } from "@/config/production";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

export const INSPECTION_TYPE_LABELS = {
  INCOMING: "Incoming",
  IN_PROCESS: "In-process",
  FINAL: "Final (Quality Check stage)",
};

const PRE_QC_STAGES = PRODUCTION_STAGES.filter((stage) => stage.sequence < 7);

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/*
 * Records an inspection with its results (POST /api/quality/inspections).
 * Results are applied only when the inspection is approved. The
 * idempotency key lives for the dialog, so a retry cannot record twice.
 */
export default function InspectionDialog({ fixedType, initialOrderId = "", onClose, onCreated }) {
  const [type, setType] = useState(fixedType ?? "FINAL");
  const [orderId, setOrderId] = useState(initialOrderId);
  const [stageKey, setStageKey] = useState(PRE_QC_STAGES[0].key);
  const [item, setItem] = useState(null);
  const [locationId, setLocationId] = useState("");
  const [values, setValues] = useState({ inspected: "", passed: "", rework: "", rejected: "", sampleSize: "", inspectorName: "", remarks: "" });
  const [defects, setDefects] = useState([]);
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const productionType = type !== "INCOMING";
  const orders = useApiData(productionType ? "/api/production/orders?status=ACTIVE&pageSize=100" : null);
  const order = useApiData(productionType && orderId ? `/api/production/orders/${orderId}` : null);
  const locations = useApiData(type === "INCOMING" ? "/api/inventory/locations?status=ACTIVE" : null);
  const qcStage = order.data?.stages?.find((stage) => stage.stageKey === "quality-check");

  const set = (field) => (event) => { setValues((current) => ({ ...current, [field]: event.target.value })); setError(""); };
  const number = (value) => (value === "" ? 0 : Number(value));
  const parts = number(values.passed) + number(values.rework) + number(values.rejected);
  const balanced = Number(values.inspected) > 0 && Math.abs(parts - Number(values.inspected)) < 1e-9;
  const ready = balanced && (productionType ? Boolean(orderId) : Boolean(item && locationId));

  async function submit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const created = await apiRequest("/api/quality/inspections", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: key,
          inspectionType: type,
          ...(productionType ? { productionOrderId: orderId } : { productId: item.id, locationId }),
          ...(type === "IN_PROCESS" ? { stageKey } : {}),
          inspectedQuantity: Number(values.inspected),
          passedQuantity: number(values.passed),
          reworkQuantity: number(values.rework),
          rejectedQuantity: number(values.rejected),
          ...(values.sampleSize ? { sampleSize: Number(values.sampleSize) } : {}),
          defects: defects.filter((defect) => defect.description.trim()).map((defect) => ({ description: defect.description.trim(), count: Number(defect.count) || 1 })),
          inspectorName: values.inspectorName,
          remarks: values.remarks,
        }),
      });
      onCreated(created);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title="Record inspection"
      description="Results are applied when the inspection is approved: a final inspection records the Quality Check stage; an incoming inspection releases or scraps held stock."
      size="large"
    >
      <form className="inv-dialog" onSubmit={submit}>
        {!fixedType && (
          <div className="inv-field">
            <label htmlFor="qi-type">Inspection type *</label>
            <select id="qi-type" value={type} onChange={(event) => { setType(event.target.value); setError(""); }}>
              {Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        )}

        {productionType ? (
          <div className="inv-dialog__grid">
            <div className="inv-field">
              <label htmlFor="qi-order">Production order *</label>
              <select id="qi-order" required value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                <option value="">{orders.error ? "Orders unavailable" : "Select order"}</option>
                {(orders.data?.orders ?? []).map((row) => <option key={row.id} value={row.id}>{row.orderNumber} · {row.sku} · {row.quantity} {row.unit}</option>)}
              </select>
            </div>
            {type === "IN_PROCESS" && (
              <div className="inv-field">
                <label htmlFor="qi-stage">Stage inspected *</label>
                <select id="qi-stage" value={stageKey} onChange={(event) => setStageKey(event.target.value)}>
                  {PRE_QC_STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.sequence}. {stage.label}</option>)}
                </select>
              </div>
            )}
          </div>
        ) : (
          <>
            <ItemPicker label="Item on quality hold" required value={item} onChange={setItem} />
            <LocationSelect label="Location holding the stock" required locations={locations.data ?? []} value={locationId} onChange={setLocationId} />
          </>
        )}
        {type === "FINAL" && qcStage && (
          <p className="inv-field__hint" role="status">{qcStage.available} {order.data.unit} waiting at Quality Check for {order.data.orderNumber}.</p>
        )}

        <div className="inv-dialog__grid">
          <div className="inv-field">
            <label htmlFor="qi-inspected">Inspected *</label>
            <input id="qi-inspected" type="number" step="any" min="0" required value={values.inspected} onChange={set("inspected")} />
          </div>
          <div className="inv-field">
            <label htmlFor="qi-passed">Passed *</label>
            <input id="qi-passed" type="number" step="any" min="0" required value={values.passed} onChange={set("passed")} />
          </div>
          <div className="inv-field">
            <label htmlFor="qi-rework">Rework</label>
            <input id="qi-rework" type="number" step="any" min="0" value={values.rework} onChange={set("rework")} />
          </div>
          <div className="inv-field">
            <label htmlFor="qi-rejected">Rejected</label>
            <input id="qi-rejected" type="number" step="any" min="0" value={values.rejected} onChange={set("rejected")} />
          </div>
          <div className="inv-field">
            <label htmlFor="qi-sample">Sample size</label>
            <input id="qi-sample" type="number" step="1" min="1" value={values.sampleSize} onChange={set("sampleSize")} />
          </div>
          <div className="inv-field">
            <label htmlFor="qi-inspector">Inspector</label>
            <input id="qi-inspector" maxLength={120} value={values.inspectorName} onChange={set("inspectorName")} />
          </div>
        </div>
        {values.inspected !== "" && !balanced && (
          <p className="inv-field__hint" role="status">Passed + rework + rejected must equal the inspected quantity.</p>
        )}

        {defects.map((defect, index) => (
          <div key={defect.key} className="inv-dialog__grid">
            <div className="inv-field">
              <label htmlFor={`qi-defect-${defect.key}`}>Defect {index + 1}</label>
              <input id={`qi-defect-${defect.key}`} maxLength={200} value={defect.description}
                onChange={(event) => setDefects((current) => current.map((row) => (row.key === defect.key ? { ...row, description: event.target.value } : row)))} />
            </div>
            <div className="inv-field">
              <label htmlFor={`qi-count-${defect.key}`}>Count</label>
              <input id={`qi-count-${defect.key}`} type="number" min="1" step="1" value={defect.count}
                onChange={(event) => setDefects((current) => current.map((row) => (row.key === defect.key ? { ...row, count: event.target.value } : row)))} />
            </div>
          </div>
        ))}
        <button type="button" className="inv-text-button" onClick={() => setDefects((current) => [...current, { key: newKey(), description: "", count: "1" }])}>+ Add defect</button>

        <div className="inv-field">
          <label htmlFor="qi-remarks">Remarks</label>
          <textarea id="qi-remarks" rows={2} maxLength={1000} value={values.remarks} onChange={set("remarks")} />
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!ready}>Record inspection</Button>
        </div>
      </form>
    </Modal>
  );
}
