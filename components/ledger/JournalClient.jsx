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

const SOURCE_LINKS = {
  Invoice: (id) => `/finance/invoices/${id}`,
  SupplierBill: (id) => `/finance/payables/bills/${id}`,
  PayrollRun: (id) => `/people-payroll/payroll/${id}`,
};
const SOURCE_LABELS = { Invoice: "Invoice", CreditNote: "Credit note", CustomerReceipt: "Customer receipt", SupplierBill: "Supplier bill", SupplierPayment: "Supplier payment", SalaryAdvance: "Salary advance", PayrollRun: "Payroll", CashTransaction: "Cash / bank" };
const toCents = (value) => Math.round(Number(value || 0) * 100);

function EntryDetail({ id, onClose, onChanged }) {
  const { can } = useCurrentUser();
  const result = useApiData(`/api/ledger/journals/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = result.data;

  async function reverse() {
    const reason = window.prompt("Reason for reversing this entry?");
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      const reversal = await apiRequest(`/api/ledger/journals/${id}`, { method: "POST", body: JSON.stringify({ entryDate: today(), reason }) });
      onChanged(reversal.id);
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={data ? `Journal entry ${data.entryNumber}` : "Journal entry"} size="large">
      {result.error ? <p className="inv-dialog__error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading…</p> : (
        <div className="inv-dialog">
          <p>
            {data.entryDate} · {data.description}
            {data.sourceType && <> · {SOURCE_LABELS[data.sourceType] ?? data.sourceType} ({data.sourceEvent?.toLowerCase()}){SOURCE_LINKS[data.sourceType] && <> · <Link href={SOURCE_LINKS[data.sourceType](data.sourceId)}>open document</Link></>}</>}
            {data.reverses && <> · reverses <button type="button" className="inv-link-button" onClick={() => onChanged(data.reverses.id)}>{data.reverses.entryNumber}</button></>}
            {data.reversedBy && <> · reversed by <button type="button" className="inv-link-button" onClick={() => onChanged(data.reversedBy.id)}>{data.reversedBy.entryNumber}</button></>}
          </p>
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Account</th><th>Memo</th><th className="inv-num">Debit</th><th className="inv-num">Credit</th></tr></thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.id}>
                    <td data-label="Account">{line.accountCode} {line.accountName}</td>
                    <td data-label="Memo">{line.memo || ""}</td>
                    <td data-label="Debit" className="inv-num">{Number(line.debit) ? formatAmount(line.debit) : ""}</td>
                    <td data-label="Credit" className="inv-num">{Number(line.credit) ? formatAmount(line.credit) : ""}</td>
                  </tr>
                ))}
                <tr><td colSpan={2}><strong>Total</strong></td><td className="inv-num"><strong>{formatAmount(data.totalAmount)}</strong></td><td className="inv-num"><strong>{formatAmount(data.totalAmount)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          {error && <p className="inv-dialog__error" role="alert">{error}</p>}
          <div className="inv-dialog__actions">
            {!data.sourceType && !data.reversesEntryId && data.status === "POSTED" && can("finance:approve") && <Button variant="secondary" loading={busy} onClick={reverse}>Reverse entry</Button>}
            <Button variant="primary" onClick={onClose}>Close</Button>
          </div>
          {data.sourceType && data.status === "POSTED" && !data.reversesEntryId && <p className="inv-field__hint">Posted automatically. To undo it, void or cancel the document itself.</p>}
        </div>
      )}
    </Modal>
  );
}

function ManualJournalDialog({ onClose, onSaved }) {
  const accounts = useApiData("/api/ledger/accounts");
  const active = (accounts.data?.accounts ?? []).filter((account) => account.status === "ACTIVE");
  const blank = () => ({ key: newKey(), accountId: "", debit: "", credit: "", memo: "" });
  const [entryDate, setEntryDate] = useState(today);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState(() => [blank(), blank()]);
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const debits = lines.reduce((sum, line) => sum + toCents(line.debit), 0);
  const credits = lines.reduce((sum, line) => sum + toCents(line.credit), 0);
  const filled = lines.filter((line) => line.accountId && (toCents(line.debit) > 0) !== (toCents(line.credit) > 0));
  const valid = description.trim().length >= 3 && filled.length >= 2 && filled.length === lines.filter((line) => line.accountId || line.debit || line.credit).length && debits === credits && debits > 0;
  const update = (lineKey, field) => (event) => setLines((current) => current.map((line) => (line.key === lineKey ? { ...line, [field]: event.target.value } : line)));

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const entry = await apiRequest("/api/ledger/journals", {
        method: "POST",
        body: JSON.stringify({ entryDate, description, idempotencyKey: key, lines: filled.map((line) => ({ accountId: line.accountId, debit: Number(line.debit || 0), credit: Number(line.credit || 0), memo: line.memo })) }),
      });
      onSaved(entry.id);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Manual journal entry" description="For opening balances, accruals and corrections. Debits must equal credits; posted entries are never edited, only reversed." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="mj-date">Date *</label><input id="mj-date" type="date" required value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="mj-desc">Description *</label><input id="mj-desc" required minLength={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        </div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Memo</th><th /></tr></thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <td data-label="Account">
                    <select aria-label={`Account ${index + 1}`} value={line.accountId} onChange={update(line.key, "accountId")}>
                      <option value="">Select account</option>
                      {active.map((account) => <option key={account.id} value={account.id}>{account.code} {account.name}</option>)}
                    </select>
                  </td>
                  <td data-label="Debit"><input aria-label={`Debit ${index + 1}`} type="number" min="0" step="0.01" value={line.debit} onChange={update(line.key, "debit")} /></td>
                  <td data-label="Credit"><input aria-label={`Credit ${index + 1}`} type="number" min="0" step="0.01" value={line.credit} onChange={update(line.key, "credit")} /></td>
                  <td data-label="Memo"><input aria-label={`Memo ${index + 1}`} maxLength={200} value={line.memo} onChange={update(line.key, "memo")} /></td>
                  <td>{lines.length > 2 && <button type="button" className="inv-link-button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Remove</button>}</td>
                </tr>
              ))}
              <tr>
                <td><button type="button" className="inv-link-button" onClick={() => setLines((current) => [...current, blank()])}>+ Add line</button></td>
                <td className="inv-num"><strong>{formatAmount((debits / 100).toFixed(2))}</strong></td>
                <td className="inv-num"><strong>{formatAmount((credits / 100).toFixed(2))}</strong></td>
                <td colSpan={2} className={debits === credits ? "" : "inv-neg"}>{debits === credits ? "Balanced" : `Out of balance by ${formatAmount((Math.abs(debits - credits) / 100).toFixed(2))}`}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Post entry</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function JournalClient({ initialEntry = "" }) {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(initialEntry);
  const [creating, setCreating] = useState(false);
  const [backfill, setBackfill] = useState({ busy: false, message: "" });
  const list = useApiData(`/api/ledger/journals${toQuery({ search, source, from, to, page, pageSize: 50 })}`);
  const rows = list.data?.entries ?? [];

  async function postMissing() {
    if (!window.confirm("Post ledger entries for every document recorded before the ledger existed? Each document is posted once, with its own date.")) return;
    setBackfill({ busy: true, message: "" });
    try {
      const result = await apiRequest("/api/ledger/post-missing", { method: "POST", body: "{}" });
      const parts = Object.entries(result.posted).map(([name, count]) => `${count} ${name}`);
      setBackfill({ busy: false, message: parts.length ? `Posted: ${parts.join(", ")}.` : "Nothing was missing." });
      list.reload();
    } catch (cause) {
      setBackfill({ busy: false, message: cause.message });
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance">Finance</Link></p>
          <h1>Journal</h1>
          <p>Every posting to the general ledger, automatic (from invoices, receipts, bills, payments, payroll and cash transactions) and manual. Entries are never edited; corrections are reversals.</p>
        </div>
        <div className="inv-header__actions">
          {can("finance:approve") && <Button variant="primary" onClick={() => setCreating(true)}>Manual journal</Button>}
          {can("finance:approve") && <Button variant="secondary" loading={backfill.busy} onClick={postMissing}>Post earlier documents</Button>}
        </div>
      </header>
      {backfill.message && <p className="inv-field__hint" role="status">{backfill.message}</p>}
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="jn-search">Search</label><input id="jn-search" type="search" placeholder="Entry number or description" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="jn-source">Source</label>
            <select id="jn-source" value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
              <option value="">All</option><option value="MANUAL">Manual</option>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="jn-from">From</label><input id="jn-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></div>
          <div className="inv-field"><label htmlFor="jn-to">To</label><input id="jn-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div>
        </div>
        {list.error ? <p className="inv-state inv-state--error" role="alert">{list.error}</p> : !list.data ? <p className="inv-state" role="status">Loading entries…</p> : rows.length === 0 ? <p className="inv-state">No journal entries match.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Entry</th><th>Date</th><th>Description</th><th>Source</th><th className="inv-num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Entry"><button type="button" className="inv-link-button" onClick={() => setViewing(row.id)}><strong>{row.entryNumber}</strong></button></td>
                    <td data-label="Date">{row.entryDate}</td>
                    <td data-label="Description">{row.description}</td>
                    <td data-label="Source">{row.sourceType ? `${SOURCE_LABELS[row.sourceType] ?? row.sourceType} · ${row.sourceEvent.toLowerCase()}` : "Manual"}{row.isReversal ? " (reversal)" : ""}</td>
                    <td data-label="Amount" className="inv-num">{formatAmount(row.totalAmount)}</td>
                    <td data-label="Status">{row.status === "POSTED" ? <span className="inv-badge inv-badge--good">Posted</span> : <span className="inv-badge inv-badge--warning">Reversed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {viewing && <EntryDetail key={viewing} id={viewing} onClose={() => setViewing("")} onChanged={(id) => { list.reload(); setViewing(id); }} />}
      {creating && <ManualJournalDialog onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); list.reload(); setViewing(id); }} />}
    </main>
  );
}
