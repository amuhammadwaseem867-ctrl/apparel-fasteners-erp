"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { newKey, todayIso } from "@/components/quality/qualityUi";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

/* New corrective or preventive action, optionally against an NCR. */
export default function CapaDialog({ ncr = null, onClose, onSaved }) {
  const openNcrs = useApiData(ncr ? null : "/api/quality/ncrs?status=ACTIVE&pageSize=200");
  const [values, setValues] = useState({ ncrId: ncr?.id ?? "", actionType: "CORRECTIVE", title: "", action: "", ownerName: "", dueDate: todayIso(14) });
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      onSaved(await apiRequest("/api/quality/capas", { method: "POST", body: JSON.stringify({ ...values, ncrId: values.ncrId || undefined, idempotencyKey: key }) }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={ncr ? `New action for ${ncr.ncrNumber}` : "New CAPA"} size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          {!ncr && (
            <div className="inv-field">
              <label htmlFor="ca-ncr">NCR</label>
              <select id="ca-ncr" value={values.ncrId} onChange={set("ncrId")}>
                <option value="">None (preventive / standalone)</option>
                {(openNcrs.data?.ncrs ?? []).map((row) => <option key={row.id} value={row.id}>{row.ncrNumber} · {row.title}</option>)}
              </select>
            </div>
          )}
          <div className="inv-field">
            <label htmlFor="ca-type">Type *</label>
            <select id="ca-type" value={values.actionType} onChange={set("actionType")}><option value="CORRECTIVE">Corrective</option><option value="PREVENTIVE">Preventive</option></select>
          </div>
          <div className="inv-field"><label htmlFor="ca-owner">Owner *</label><input id="ca-owner" required minLength={2} maxLength={120} value={values.ownerName} onChange={set("ownerName")} /></div>
          <div className="inv-field"><label htmlFor="ca-due">Due date *</label><input id="ca-due" type="date" required value={values.dueDate} onChange={set("dueDate")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="ca-title">Title *</label><input id="ca-title" required minLength={3} maxLength={160} value={values.title} onChange={set("title")} /></div>
        <div className="inv-field"><label htmlFor="ca-action">Action to take *</label><textarea id="ca-action" required minLength={3} rows={3} maxLength={4000} value={values.action} onChange={set("action")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Create action</Button>
        </div>
      </form>
    </Modal>
  );
}
