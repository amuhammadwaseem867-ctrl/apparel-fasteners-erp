"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import AccountStatement from "@/components/ledger/AccountStatement";
import { formatAmount } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TYPES = [["ASSET", "Assets"], ["LIABILITY", "Liabilities"], ["EQUITY", "Equity"], ["INCOME", "Income"], ["EXPENSE", "Expenses"]];

function AccountDialog({ account, onClose, onSaved }) {
  const [values, setValues] = useState({ code: "", name: account?.name ?? "", accountType: "EXPENSE", isCashBank: false, description: account?.description ?? "", status: account?.status ?? "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(account ? `/api/ledger/accounts/${account.id}` : "/api/ledger/accounts", {
        method: account ? "PATCH" : "POST",
        body: JSON.stringify(account
          ? { name: values.name, description: values.description, status: values.status }
          : { code: values.code.toUpperCase(), name: values.name, accountType: values.accountType, isCashBank: values.accountType === "ASSET" && values.isCashBank, description: values.description }),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={account ? `Edit ${account.code}` : "New ledger account"} description={account ? "Code and type are fixed once created." : "Accounts are never deleted; deactivate ones you no longer use."} size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          {!account && <div className="inv-field"><label htmlFor="ac-code">Code *</label><input id="ac-code" required pattern="[0-9A-Za-z\-]{2,12}" maxLength={12} value={values.code} onChange={set("code")} /></div>}
          <div className="inv-field"><label htmlFor="ac-name">Name *</label><input id="ac-name" required minLength={2} maxLength={120} value={values.name} onChange={set("name")} /></div>
          {!account && (
            <div className="inv-field">
              <label htmlFor="ac-type">Type *</label>
              <select id="ac-type" value={values.accountType} onChange={set("accountType")}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
          )}
          {account && !account.systemKey && (
            <div className="inv-field">
              <label htmlFor="ac-status">Status</label>
              <select id="ac-status" value={values.status} onChange={set("status")}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
            </div>
          )}
        </div>
        {!account && values.accountType === "ASSET" && (
          <label className="inv-check" htmlFor="ac-cash"><input id="ac-cash" type="checkbox" checked={values.isCashBank} onChange={set("isCashBank")} /> Cash or bank account (money can be paid from / received into it)</label>
        )}
        <div className="inv-field"><label htmlFor="ac-desc">Description</label><input id="ac-desc" maxLength={300} value={values.description} onChange={set("description")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{account ? "Save" : "Create account"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AccountsPage() {
  const { can } = useCurrentUser();
  const result = useApiData("/api/ledger/accounts");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const accounts = result.data?.accounts ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance">Finance</Link></p>
          <h1>Chart of accounts</h1>
          <p>Balances to date from posted journal entries. System accounts are used by automatic postings (invoices, receipts, bills, payments, payroll) and stay active.</p>
        </div>
        <div className="inv-header__actions">{can("finance:approve") && <Button variant="primary" onClick={() => setEditing("new")}>New account</Button>}</div>
      </header>
      {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !result.data ? <p className="inv-state" role="status">Loading accountsâ€¦</p> : TYPES.map(([type, label]) => {
        const group = accounts.filter((account) => account.accountType === type);
        return (
          <section key={type} className="inv-card">
            <div className="inv-card__header"><h2>{label}</h2></div>
            {group.length === 0 ? <p className="inv-state">No {label.toLowerCase()} accounts.</p> : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead><tr><th>Code</th><th>Account</th><th className="inv-num">Balance</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {group.map((account) => (
                      <tr key={account.id}>
                        <td data-label="Code">{account.code}</td>
                        <td data-label="Account"><button type="button" className="inv-link-button" onClick={() => setViewing(account)}><strong>{account.name}</strong></button><small>{[account.systemKey ? "System" : "", account.isCashBank ? "Cash / bank" : "", account.description].filter(Boolean).join(" · ")}</small></td>
                        <td data-label="Balance" className={`inv-num ${Number(account.balance) < 0 ? "inv-neg" : ""}`}>{formatAmount(account.balance)}</td>
                        <td data-label="Status">{account.status === "ACTIVE" ? <span className="inv-badge inv-badge--good">Active</span> : <span className="inv-badge inv-badge--danger">Inactive</span>}</td>
                        <td data-label="">{can("finance:approve") && <button type="button" className="inv-link-button" onClick={() => setEditing(account)}>Edit</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      {editing && <AccountDialog account={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); result.reload(); }} />}
      {viewing && <AccountStatement account={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}

