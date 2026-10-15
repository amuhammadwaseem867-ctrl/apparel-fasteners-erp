"use client";

import Link from "next/link";
import { useState } from "react";

import Modal from "@/components/ui/Modal";
import { formatAmount, today } from "@/components/finance/financeUi";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

/* Account statement: opening balance, posted lines, running balance. */
export default function AccountStatement({ account, onClose }) {
  const [from, setFrom] = useState(`${today().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const result = useApiData(`/api/ledger/accounts/${account.id}/ledger${toQuery({ from, to })}`);
  const data = result.data;
  return (
    <Modal open onClose={onClose} title={`${account.code} ${account.name}`} description="Balances are shown in the account's normal direction." size="large">
      <div className="inv-dialog">
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="as-from">From</label><input id="as-from" type="date" max={to} value={from} onChange={(event) => setFrom(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="as-to">To</label><input id="as-to" type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></div>
        </div>
        {result.error ? <p className="inv-dialog__error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading…</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Date</th><th>Entry</th><th>Description</th><th className="inv-num">Debit</th><th className="inv-num">Credit</th><th className="inv-num">Balance</th></tr></thead>
              <tbody>
                <tr><td colSpan={5}><strong>Opening balance</strong></td><td className="inv-num"><strong>{formatAmount(data.openingBalance)}</strong></td></tr>
                {data.lines.map((line, index) => (
                  <tr key={`${line.entryId}-${index}`}>
                    <td data-label="Date">{line.entryDate}</td>
                    <td data-label="Entry"><Link href={`/finance/transactions?entry=${line.entryId}`}>{line.entryNumber}</Link></td>
                    <td data-label="Description">{line.description}{line.memo && <small>{line.memo}</small>}</td>
                    <td data-label="Debit" className="inv-num">{Number(line.debit) ? formatAmount(line.debit) : ""}</td>
                    <td data-label="Credit" className="inv-num">{Number(line.credit) ? formatAmount(line.credit) : ""}</td>
                    <td data-label="Balance" className="inv-num">{formatAmount(line.balance)}</td>
                  </tr>
                ))}
                <tr><td colSpan={5}><strong>Closing balance</strong></td><td className="inv-num"><strong>{formatAmount(data.closingBalance)}</strong></td></tr>
              </tbody>
            </table>
            {data.truncated && <p className="inv-field__hint">Showing the first 2,000 lines; narrow the dates to see the rest.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
