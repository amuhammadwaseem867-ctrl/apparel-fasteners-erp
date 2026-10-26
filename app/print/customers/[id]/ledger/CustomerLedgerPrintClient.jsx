"use client";

/*
 * AF7 customer ledger (khata, D-052): the customer's account with a
 * running balance, for a period or from the start, to print or hand over.
 */

import Link from "next/link";

import { Af7Fields, Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import { formatAmount } from "@/components/finance/financeUi";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";

const day = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const amount = (value) => (Number(value) ? formatAmount(value) : "");
/* Balance with Dr (they owe) or Cr (paid in advance). */
const balance = (value) => `${formatAmount(String(Math.abs(Number(value))))} ${Number(value) < 0 ? "Cr" : "Dr"}`;

export default function CustomerLedgerPrintClient({ id, from, to }) {
  const company = useCompany();
  const { data: ledger, error } = useApiData(`/api/customers/${encodeURIComponent(id)}/ledger${toQuery({ from, to })}`);
  const backHref = `/sales/customers/${encodeURIComponent(id)}`;

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href={backHref}>Back to customer</Link></main>;
  if (!ledger) return <main className="print-doc print-doc--message"><p role="status">Loading ledger…</p></main>;
  const { customer } = ledger;
  const period = from || to ? `${from ? day(from) : "Start"} to ${to ? day(to) : "today"}` : "All entries";

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={backHref}>Back to customer</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page
        company={company}
        title="CUSTOMER LEDGER"
        subtitle={<Af7Fields rows={[["Period", period], ["Printed", day(new Date().toISOString().slice(0, 10))]]} />}
      >
        <Af7Section number="1" title="Customer">
          <Af7Fields rows={[
            ["M/s", customer.name],
            ["Address", customer.address],
            ["Contact", [customer.contactPerson, customer.phone].filter(Boolean).join(" · ")],
            ["NTN #", customer.ntn],
          ]} />
        </Af7Section>

        <Af7Section number="2" title="Account">
          <table className="af7__table">
            <colgroup>
              <col style={{ width: "12%" }} /><col style={{ width: "14%" }} /><col style={{ width: "35%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr><th>Date</th><th>Ref. no.</th><th>Particulars</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
            </thead>
            <tbody>
              {ledger.rows.length === 0 && <tr><td colSpan={6} className="center">No entries.</td></tr>}
              {ledger.rows.map((row, index) => (
                <tr key={`${row.kind}-${row.sourceId ?? index}`}>
                  <td>{day(row.date)}</td>
                  <td>{row.reference}</td>
                  <td>{row.particulars}</td>
                  <td className="num">{amount(row.debit)}</td>
                  <td className="num">{amount(row.credit)}</td>
                  <td className="num">{balance(row.balance)}</td>
                </tr>
              ))}
              <tr className="af7__total-row">
                <td colSpan={3}>TOTAL</td>
                <td className="num">{formatAmount(ledger.totalDebit)}</td>
                <td className="num">{formatAmount(ledger.totalCredit)}</td>
                <td className="num">{balance(ledger.balance)}</td>
              </tr>
            </tbody>
          </table>
          <p><strong>Balance {Number(ledger.balance) < 0 ? "in the customer's favour" : "due from the customer"}: {formatAmount(String(Math.abs(Number(ledger.balance))))}</strong></p>
        </Af7Section>

        <div className="af7__spacer" />
        <Af7Section number="3" title="Authorization / signature">
          <Af7Signatures roles={[["PREPARED BY"], ["CHECKED BY"], ["CUSTOMER ACKNOWLEDGEMENT"]]} />
        </Af7Section>
      </Af7Page>
    </main>
  );
}
