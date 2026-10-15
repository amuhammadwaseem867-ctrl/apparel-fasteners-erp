"use client";

import Link from "next/link";
import { useState } from "react";

import AccountStatement from "@/components/ledger/AccountStatement";
import CashTransactionsClient from "@/components/ledger/CashTransactionsClient";
import { formatAmount } from "@/components/finance/financeUi";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function CashBankPage() {
  const summary = useApiData("/api/ledger/summary");
  const [viewing, setViewing] = useState(null);
  const data = summary.data;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance">Finance</Link></p>
          <h1>Cash &amp; bank</h1>
          <p>Ledger balances of cash and bank accounts. Customer receipts and supplier payments marked &quot;Cash&quot; post to Cash in hand; other methods post to Bank. Add more bank accounts on the chart of accounts.</p>
        </div>
      </header>
      <section className="inv-card">
        {summary.error ? <p className="inv-state inv-state--error" role="alert">{summary.error}</p> : !data ? <p className="inv-state" role="status">Loading…</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Account</th><th className="inv-num">Balance as of {data.asOf}</th></tr></thead>
              <tbody>
                {data.cashBank.map((account) => (
                  <tr key={account.id}>
                    <td data-label="Account"><button type="button" className="inv-link-button" onClick={() => setViewing(account)}><strong>{account.code} {account.name}</strong></button>{account.status !== "ACTIVE" && <small>Inactive</small>}</td>
                    <td data-label="Balance" className={`inv-num ${Number(account.balance) < 0 ? "inv-neg" : ""}`}>{formatAmount(account.balance)}</td>
                  </tr>
                ))}
                <tr><td><strong>Total</strong></td><td className="inv-num"><strong>{formatAmount(data.cashBankTotal)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
      <CashTransactionsClient kind="TRANSFER" embedded />
      {viewing && <AccountStatement account={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}
