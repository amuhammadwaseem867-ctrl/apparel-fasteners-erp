"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function RoleDialog({ role, permissions, onClose, onSaved }) {
  const editing = Boolean(role);
  const [values, setValues] = useState({ code: role?.code ?? "", name: role?.name ?? "", description: role?.description ?? "" });
  const [granted, setGranted] = useState(role?.permissions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modules = [...new Set(permissions.map((permission) => permission.module))];
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify(editing ? { name: values.name, description: values.description, permissions: granted } : { ...values, permissions: granted });
      onSaved(await apiRequest(editing ? `/api/admin/roles/${role.id}` : "/api/admin/roles", { method: editing ? "PUT" : "POST", body }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={editing ? `Edit ${role.name}` : "New role"}
      description="A role is a named set of permissions. Changes apply to every user with the role on their next request." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="ro-code">Code *</label><input id="ro-code" required pattern="[A-Z][A-Z0-9_]{1,39}" title="Capital letters, digits and underscores" disabled={editing} value={values.code} onChange={(event) => setValues((current) => ({ ...current, code: event.target.value.toUpperCase() }))} /></div>
          <div className="inv-field"><label htmlFor="ro-name">Name *</label><input id="ro-name" required minLength={2} maxLength={80} value={values.name} onChange={set("name")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="ro-desc">Description *</label><input id="ro-desc" required minLength={2} maxLength={300} value={values.description} onChange={set("description")} /></div>
        {modules.map((module) => (
          <fieldset key={module} className="inv-dialog__line">
            <legend>{module}</legend>
            {permissions.filter((permission) => permission.module === module).map((permission) => (
              <label key={permission.code} style={{ display: "inline-flex", gap: 6, marginRight: 16, fontSize: 13 }} title={permission.description}>
                <input type="checkbox" checked={granted.includes(permission.code)}
                  onChange={(event) => setGranted((current) => (event.target.checked ? [...current, permission.code] : current.filter((code) => code !== permission.code)))} />
                {permission.name}
              </label>
            ))}
          </fieldset>
        ))}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{editing ? "Save role" : "Create role"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RolesPage() {
  const roles = useApiData("/api/admin/roles");
  const permissions = useApiData("/api/admin/permissions");
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState("");
  const rows = roles.data?.roles ?? [];

  async function toggle(role) {
    const status = role.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (status === "DISABLED" && !window.confirm(`Disable ${role.name}? Its ${role.activeUsers} active users lose its permissions immediately.`)) return;
    setError("");
    try {
      await apiRequest(`/api/admin/roles/${role.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      roles.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Administration</p>
          <h1>Roles &amp; Permissions</h1>
          <p>System roles are managed by the application and are read-only. Create custom roles for other combinations of permissions.</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setDialog({ role: null })} disabled={!permissions.data}>New role</Button>
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        {roles.error ? (
          <p className="inv-state inv-state--error" role="alert">{roles.error}</p>
        ) : !roles.data ? (
          <p className="inv-state" role="status">Loading roles…</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Role</th><th>Type</th><th className="inv-num">Permissions</th><th className="inv-num">Active users</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((role) => (
                  <tr key={role.id}>
                    <td data-label="Role">
                      <strong>{role.name}</strong><small>{role.code} · {role.description}</small>
                      {expanded === role.id && <small style={{ display: "block", whiteSpace: "normal" }}>{role.permissions.join(", ") || "No permissions"}</small>}
                    </td>
                    <td data-label="Type">{role.isSystem ? "System" : "Custom"}</td>
                    <td data-label="Permissions" className="inv-num"><button type="button" className="inv-text-button" onClick={() => setExpanded(expanded === role.id ? "" : role.id)}>{role.permissions.length}</button></td>
                    <td data-label="Active users" className="inv-num">{role.activeUsers}</td>
                    <td data-label="Status"><span className={`inv-badge inv-badge--${role.status === "ACTIVE" ? "good" : "danger"}`}>{role.status === "ACTIVE" ? "Active" : "Disabled"}</span></td>
                    <td data-label="Actions">
                      {!role.isSystem && (
                        <>
                          <button type="button" className="inv-text-button" onClick={() => setDialog({ role })} disabled={!permissions.data}>Edit</button>{" "}
                          <button type="button" className="inv-text-button" onClick={() => toggle(role)}>{role.status === "ACTIVE" ? "Disable" : "Enable"}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {dialog && (
        <RoleDialog role={dialog.role} permissions={permissions.data?.permissions ?? []} onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); roles.reload(); }} />
      )}
    </main>
  );
}
