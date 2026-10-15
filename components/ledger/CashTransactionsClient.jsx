"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { formatAmount, newKey, today } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const COPY = {
  EXPENSE: { title: "Expenses", eyebrow: "Finance", intro: "Money paid out of a cash or bank account for an expense (rent, utilities, repairs…). Each expense posts Dr expense / Cr cash or bank. Supplier invoices for goods belong in Payables.", button: "Record expense", counterLabel: "Expense account", counterTypes: ["EXPENSE"], cashLabel: "Paid from" },
  INCOME: { title: "Other income", eyebrow: "Finance", intro: "Money received that is not a customer invoice (scrap sales, interest, refunds…). Each posts Dr cash or bank / Cr income. Customer payments are recorded against invoices.", button: "Record income", counterLabel: "Income account", counterTypes: ["INCOME"], cashLabel: "Received into" },
  TRANSFER: { title: "Transfers", eyebrow: "Cash & bank", intro: "Moves between cash and bank accounts.", button: "Record transfer", counterLabel: "To account", counterTypes: ["ASSET"], cashLabel: "From account" },
};

function TransactionDialog({ kind, accounts, onClose, onSaved }) {
  const copy = COPY[kind];
  const cashAccounts = accounts.filter((account) => account.isCashBank && account.status === "ACTIVE");
  const counters = accounts.filter((account) => account.status === "ACTIVE" && copy.counterTypes.includes(account.accountType) && (kind !== "TRANSFER" || account.isCashBank));
  const [values, setValues] = useState({ transactionDate: today(), cashAccountId: cashAccounts.find((account) => account.systemKey === "BANK")?.id ?? "", counterAccountId: "", amount: "", payee: "", reference: "", description: "" });
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const valid = values.cashAccountId && values.counterAccountId && values.cashAccountId !== values.counterAccountId && Number(values.amount) > 0 && values.description.trim().length >= 3;

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/ledger/cash-transactions", { method: "POST", body: JSON.stringify({ ...values, kind, amount: Number(values.amount), idempotencyKey: key }) });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={copy.button} size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="ct-date">Date *</label><input id="ct-date" type="date" required value={values.transactionDate} onChange={set("transactionDate")} /></div>
          <div className="inv-field"><label htmlFor="ct-amount">Amount *</label><input id="ct-amount" type="number" min="0.01" step="0.01" required value={values.amount} onChange={set("amount")} /></div>
          <div className="inv-field">
            <label htmlFor="ct-cash">{copy.cashLabel} *</label>
            <select id="ct-cash" required value={values.cashAccountId} onChange={set("cashAccountId")}>
              <option value="">Select account</option>
              {cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} {account.name} ({formatAmount(account.balance)})</option>)}
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="ct-counter">{copy.counterLabel} *</label>
            <select id="ct-counter" required value={values.counterAccountId} onChange={set("counterAccountId")}>
              <option value="">Select account</option>
              {counters.filter((account) => account.id !== values.cashAccountId).map((account) => <option key={account.id} value={account.id}>{account.code} {account.name}</option>)}
            </select>
          </div>
          {kind !== "TRANSFER" && <div className="inv-field"><label htmlFor="ct-payee">{kind === "EXPENSE" ? "Paid to" : "Received from"}</label><input id="ct-payee" maxLength={160} value={values.payee} onChange={set("payee")} /></div>}
          <div className="inv-field"><label htmlFor="ct-ref">Reference</label><input id="ct-ref" maxLength={120} placeholder="Voucher / cheque / transaction no." value={values.reference} onChange={set("reference")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="ct-desc">Description *</label><input id="ct-desc" required minLength={3} maxLength={300} value={values.description} onChange={set("description")} /></div>
        {kind !== "TRANSFER" && <p className="inv-field__hint">Need another account? Add it on <Link href="/finance/accounts">Chart of accounts</Link>.</p>}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Post</Button>
        </div>
      </form>
    </Modal>
  );
}

/* Lists and records one kind of cash transaction (expense, income, transfer). */
export default function CashTransactionsClient({ kind, embedded = false }) {
  const copy = COPY[kind];
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const accounts = useApiData("/api/ledger/accounts");
  const list = useApiData(`/api/ledger/cash-transactions${toQuery({ kind, search, from, to, page, pageSize: 25 })}`);
  const rows = list.data?.transactions ?? [];

  async function voidRow(row) {
    const reason = window.prompt(`Reason for voiding ${row.transactionNumber}?`);
    if (!reason) return;
    setError("");
    try {
      await apiRequest(`/api/ledger/cash-transactions/${row.id}`, { method: "PATCH", body: JSON.stringify({ reason }) });
      list.reload();
      accounts.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  const body = (
    <section className="inv-card">
      {embedded && (
        <div className="inv-card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{copy.title}</h2>
          {can("finance:create") && <Button variant="primary" disabled={!accounts.data} onClick={() => setCreating(true)}>{copy.button}</Button>}
        </div>
      )}
      <div className="inv-toolbar">
        <div className="inv-field"><label htmlFor={`ct-search-${kind}`}>Search</label><input id={`ct-search-${kind}`} type="search" placeholder="Number, description, payee, reference" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
        <div className="inv-field"><label htmlFor={`ct-from-${kind}`}>From</label><input id={`ct-from-${kind}`} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></div>
        <div className="inv-field"><label htmlFor={`ct-to-${kind}`}>To</label><input id={`ct-to-${kind}`} type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div>
      </div>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {list.error ? (
        <p className="inv-state inv-state--error" role="alert">{list.error}</p>
      ) : !list.data ? (
        <p className="inv-state" role="status">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="inv-state">{search || from || to ? "Nothing matches these filters." : `No ${copy.title.toLowerCase()} recorded yet.`}</p>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Number</th><th>Description</th><th>{copy.cashLabel}</th><th>{copy.counterLabel}</th><th className="inv-num">Amount</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Number"><strong>{row.transactionNumber}</strong><small>{row.transactionDate}</small></td>
                  <td data-label="Description">{row.description}<small>{[row.payee, row.reference].filter(Boolean).join(" · ")}</small></td>
                  <td data-label={copy.cashLabel}>{row.cashAccountName}</td>
                  <td data-label={copy.counterLabel}>{row.counterAccountName}</td>
                  <td data-label="Amount" className="inv-num">{formatAmount(row.amount)}</td>
                  <td data-label="Status">{row.status === "POSTED" ? <span className="inv-badge inv-badge--good">Posted</span> : <span className="inv-badge inv-badge--danger">Voided</span>}</td>
                  <td data-label="">
                    {row.journalEntryId && <Link href={`/finance/transactions?entry=${row.journalEntryId}`}>Entry</Link>}
                    {row.status === "POSTED" && can("finance:approve") && <> · <button type="button" className="inv-link-button" onClick={() => voidRow(row)}>Void</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      {creating && accounts.data && <TransactionDialog kind={kind} accounts={accounts.data.accounts} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload(); accounts.reload(); }} />}
    </section>
  );

  if (embedded) return body;
  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance">{copy.eyebrow}</Link></p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <div className="inv-header__actions">{can("finance:create") && <Button variant="primary" disabled={!accounts.data} onClick={() => setCreating(true)}>{copy.button}</Button>}</div>
      </header>
      {body}
    </main>
  );
}
