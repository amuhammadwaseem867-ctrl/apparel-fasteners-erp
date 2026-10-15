"use client";

import Link from "next/link";
import { useState } from "react";

import { formatAmount, today } from "@/components/finance/financeUi";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const STATEMENTS = [["profit-and-loss", "Profit and loss"], ["balance-sheet", "Balance sheet"], ["trial-balance", "Trial balance"]];

function Section({ title, rows, total, totalLabel }) {
  return (
    <>
      <tr><td colSpan={2}><strong>{title}</strong></td></tr>
      {rows.length === 0 ? <tr><td colSpan={2} style={{ paddingLeft: 24 }}>None</td></tr> : rows.map((row) => (
        <tr key={row.id}><td style={{ paddingLeft: 24 }}>{row.code} {row.name}</td><td className="inv-num">{formatAmount(row.balance)}</td></tr>
      ))}
      <tr><td><strong>{totalLabel}</strong></td><td className="inv-num"><strong>{formatAmount(total)}</strong></td></tr>
    </>
  );
}

export default function FinancialReportsPage() {
  const [statement, setStatement] = useState("profit-and-loss");
  const [from, setFrom] = useState(() => `${today().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const result = useApiData(`/api/ledger/statements/${statement}${toQuery({ from: statement === "profit-and-loss" ? from : "", to })}`);
  // The previous statement's data stays until the new one arrives; only render a matching shape.
  const shapeKey = { "profit-and-loss": "income", "balance-sheet": "assets", "trial-balance": "accounts" }[statement];
  const data = result.data && shapeKey in result.data ? result.data : null;
  const label = STATEMENTS.find(([key]) => key === statement)[1];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance">Finance</Link></p>
          <h1>Financial statements</h1>
          <p>Built from posted journal entries only. Stock is not valued in the ledger (purchases are expensed when billed), so these are cash-and-accruals statements without inventory or cost of goods sold.</p>
        </div>
        <div className="inv-header__actions"><button type="button" className="inv-link-button" onClick={() => window.print()} disabled={!data}>Print</button></div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="fs-statement">Statement</label>
            <select id="fs-statement" value={statement} onChange={(event) => setStatement(event.target.value)}>{STATEMENTS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
          </div>
          {statement === "profit-and-loss" && <div className="inv-field"><label htmlFor="fs-from">From</label><input id="fs-from" type="date" max={to} value={from} onChange={(event) => setFrom(event.target.value)} /></div>}
          <div className="inv-field"><label htmlFor="fs-to">{statement === "profit-and-loss" ? "To" : "As of"}</label><input id="fs-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
        </div>
        {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading {label.toLowerCase()}…</p> : (
          <div className="inv-table-wrap">
            <h2 style={{ padding: "8px 18px" }}>{label} {statement === "profit-and-loss" ? `${data.from} to ${data.to}` : `as of ${data.asOf}`}</h2>
            {statement === "profit-and-loss" && (
              <table className="inv-table">
                <tbody>
                  <Section title="Income" rows={data.income} total={data.totalIncome} totalLabel="Total income" />
                  <Section title="Expenses" rows={data.expenses} total={data.totalExpenses} totalLabel="Total expenses" />
                  <tr><td><strong>{Number(data.netProfit) < 0 ? "Net loss" : "Net profit"}</strong></td><td className={`inv-num ${Number(data.netProfit) < 0 ? "inv-neg" : ""}`}><strong>{formatAmount(data.netProfit)}</strong></td></tr>
                </tbody>
              </table>
            )}
            {statement === "balance-sheet" && (
              <table className="inv-table">
                <tbody>
                  <Section title="Assets" rows={data.assets} total={data.totalAssets} totalLabel="Total assets" />
                  <Section title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} totalLabel="Total liabilities" />
                  <Section title="Equity" rows={[...data.equity, { id: "earnings", code: "", name: "Current earnings (income less expenses to date)", balance: data.currentEarnings }]} total={data.totalEquity} totalLabel="Total equity" />
                  <tr><td><strong>Liabilities and equity</strong></td><td className="inv-num"><strong>{formatAmount(data.totalLiabilitiesAndEquity)}</strong></td></tr>
                </tbody>
              </table>
            )}
            {statement === "trial-balance" && (
              <table className="inv-table">
                <thead><tr><th>Account</th><th className="inv-num">Debit</th><th className="inv-num">Credit</th></tr></thead>
                <tbody>
                  {data.accounts.map((row) => <tr key={row.id}><td data-label="Account">{row.code} {row.name}</td><td data-label="Debit" className="inv-num">{Number(row.netDebit) ? formatAmount(row.netDebit) : ""}</td><td data-label="Credit" className="inv-num">{Number(row.netCredit) ? formatAmount(row.netCredit) : ""}</td></tr>)}
                  <tr><td><strong>Total</strong></td><td className="inv-num"><strong>{formatAmount(data.totalDebit)}</strong></td><td className="inv-num"><strong>{formatAmount(data.totalCredit)}</strong></td></tr>
                </tbody>
              </table>
            )}
            {"balanced" in data && (
              <p className={`inv-field__hint ${data.balanced ? "" : "inv-neg"}`} style={{ padding: "8px 18px" }} role="status">
                {data.balanced ? "In balance." : "OUT OF BALANCE: report this; the ledger should never be out of balance."}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
