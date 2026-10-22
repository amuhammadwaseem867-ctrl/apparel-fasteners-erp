"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { apiRequest } from "@/lib/api/client";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function when(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "â€”";
}

function RolePicker({ roles, value, onChange }) {
  return (
    <fieldset className="inv-dialog__line">
      <legend>Roles</legend>
      {roles.filter((role) => role.status === "ACTIVE").map((role) => (
        <label key={role.code} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
          <input type="checkbox" checked={value.includes(role.code)}
            onChange={(event) => onChange(event.target.checked ? [...value, role.code] : value.filter((code) => code !== role.code))} />
          <span><strong>{role.name}</strong> <small>({role.permissions.length} permissions) · {role.description}</small></span>
        </label>
      ))}
    </fieldset>
  );
}

function UserDialog({ user, roles, onClose, onSaved }) {
  const editing = Boolean(user);
  const [values, setValues] = useState({
    employeeCode: user?.employeeCode ?? "",
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    roles: user?.roles ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = editing
        ? await apiRequest(`/api/admin/users/${user.id}`, { method: "PUT", body: JSON.stringify({ name: values.name, phone: values.phone, roles: values.roles }) })
        : await apiRequest("/api/admin/users", { method: "POST", body: JSON.stringify(values) });
      onSaved(saved);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={editing ? `Edit ${user.name}` : "New user"}
      description={editing ? "Changes to roles apply on the user's next request." : "The user signs in with this email and password and should change the password from their profile."}
      size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="us-code">Employee code *</label><input id="us-code" required minLength={2} maxLength={40} disabled={editing} value={values.employeeCode} onChange={set("employeeCode")} /></div>
          <div className="inv-field"><label htmlFor="us-name">Name *</label><input id="us-name" required minLength={2} maxLength={120} value={values.name} onChange={set("name")} /></div>
          <div className="inv-field"><label htmlFor="us-email">Email *</label><input id="us-email" type="email" required disabled={editing} value={values.email} onChange={set("email")} /></div>
          <div className="inv-field"><label htmlFor="us-phone">Phone</label><input id="us-phone" maxLength={40} value={values.phone} onChange={set("phone")} /></div>
          {!editing && <div className="inv-field"><label htmlFor="us-password">Initial password *</label><input id="us-password" type="password" required minLength={8} autoComplete="new-password" value={values.password} onChange={set("password")} /></div>}
        </div>
        <RolePicker roles={roles} value={values.roles} onChange={(next) => setValues((current) => ({ ...current, roles: next }))} />
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{editing ? "Save" : "Create user"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordDialog({ user, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/admin/users/${user.id}/password`, { method: "POST", body: JSON.stringify({ password }) });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Reset password for ${user.name}`} description="All of this user's sessions end immediately. Give them the new password securely." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field"><label htmlFor="pw-new">New password *</label><input id="pw-new" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={password.length < 8}>Reset password</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const users = useApiData(`/api/admin/users${toQuery({ search, status, role, page, pageSize: 25 })}`);
  const roles = useApiData("/api/admin/roles");
  const roleList = roles.data?.roles ?? [];
  const rows = users.data?.users ?? [];

  async function toggle(user) {
    const next = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (next === "DISABLED" && !window.confirm(`Disable ${user.name}? They are signed out everywhere and cannot sign in until re-enabled.`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setNotice(`${user.name} ${next === "DISABLED" ? "disabled" : "enabled"}.`);
      users.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Administration</p>
          <h1>Users</h1>
          <p>Accounts and their roles. Permissions come only from active roles. The system always keeps at least one active user who can manage users.</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setDialog({ type: "edit", user: null })} disabled={!roles.data}>New user</Button>
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {notice && <p className="inv-state" role="status">{notice}</p>}

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="us-search">Search</label><input id="us-search" type="search" placeholder="Name, email or employee code" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="us-status">Status</label>
            <select id="us-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option>
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="us-role">Role</label>
            <select id="us-role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}>
              <option value="">Any role</option>
              {roleList.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </div>
        </div>
        {users.error ? (
          <p className="inv-state inv-state--error" role="alert">{users.error}</p>
        ) : !users.data ? (
          <p className="inv-state" role="status">Loading usersâ€¦</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No users match these filters.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>User</th><th>Employee code</th><th>Roles</th><th>Last sign-in</th><th className="inv-num">Sessions</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td data-label="User"><strong>{user.name}</strong><small>{user.email}</small></td>
                    <td data-label="Employee code">{user.employeeCode}</td>
                    <td data-label="Roles">{user.roles.length ? user.roles.map((code) => roleList.find((item) => item.code === code)?.name ?? code).join(", ") : <span className="inv-neg">No role</span>}</td>
                    <td data-label="Last sign-in">{when(user.lastLoginAt)}</td>
                    <td data-label="Sessions" className="inv-num">{user.activeSessions}</td>
                    <td data-label="Status"><span className={`inv-badge inv-badge--${user.status === "ACTIVE" ? "good" : "danger"}`}>{user.status === "ACTIVE" ? "Active" : "Disabled"}</span></td>
                    <td data-label="Actions">
                      <button type="button" className="inv-text-button" onClick={() => setDialog({ type: "edit", user })}>Edit</button>{" "}
                      <button type="button" className="inv-text-button" onClick={() => setDialog({ type: "password", user })}>Reset password</button>{" "}
                      <button type="button" className="inv-text-button" onClick={() => toggle(user)}>{user.status === "ACTIVE" ? "Disable" : "Enable"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={users.data?.hasMore} onChange={setPage} disabled={users.loading} />
      </section>

      {dialog?.type === "edit" && (
        <UserDialog user={dialog.user} roles={roleList} onClose={() => setDialog(null)}
          onSaved={(saved) => { setDialog(null); setNotice(`${saved.name} saved.`); users.reload(); }} />
      )}
      {dialog?.type === "password" && (
        <PasswordDialog user={dialog.user} onClose={() => setDialog(null)}
          onDone={() => { setNotice(`Password reset for ${dialog.user.name}; their sessions have ended.`); setDialog(null); users.reload(); }} />
      )}
    </main>
  );
}

