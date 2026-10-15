"use client";

import Link from "next/link";

import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TYPES = {
  INCOMING: { label: "Incoming", href: "/quality/incoming" },
  IN_PROCESS: { label: "In-process", href: "/quality/in-process" },
  FINAL: { label: "Final (Quality Check)", href: "/quality/final" },
};

function passRate(row) {
  const inspected = Number(row.inspected);
  return inspected ? `${((Number(row.passed) / inspected) * 100).toFixed(1)}%` : "—";
}

export default function QualityPage() {
  const summary = useApiData("/api/quality/summary");
  const rows = summary.data?.byType ?? [];
  const open = rows.reduce((sum, row) => sum + row.open, 0);

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Quality</p>
          <h1>Quality</h1>
          <p>Incoming, in-process and final inspections. Figures are totals of approved inspections; nothing here is estimated.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/quality/inspections">All inspections</Link>
        </div>
      </header>

      {summary.error ? (
        <p className="inv-dialog__error" role="alert">{summary.error}</p>
      ) : !summary.data ? (
        <p className="inv-state" role="status">Loading quality summary…</p>
      ) : (
        <>
          <section className="inv-kpis" aria-label="Inspections">
            <div className={`inv-kpi ${open ? "inv-kpi--warning" : ""}`}><span>Awaiting approval</span><strong>{open}</strong></div>
            {rows.map((row) => (
              <div key={row.type} className="inv-kpi"><span>{TYPES[row.type].label} approved</span><strong>{row.approved}</strong><small>pass rate {passRate(row)}</small></div>
            ))}
          </section>
          <section className="inv-card">
            <div className="inv-card__header"><h2>Approved results by inspection type</h2><small>Pass rate = passed ÷ inspected, rounded for display.</small></div>
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Type</th><th className="inv-num">Open</th><th className="inv-num">Approved</th><th className="inv-num">Inspected</th><th className="inv-num">Passed</th><th className="inv-num">Rework</th><th className="inv-num">Rejected</th><th className="inv-num">Pass rate</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.type}>
                      <td data-label="Type"><Link href={TYPES[row.type].href}>{TYPES[row.type].label}</Link></td>
                      <td data-label="Open" className="inv-num">{row.open}</td>
                      <td data-label="Approved" className="inv-num">{row.approved}</td>
                      <td data-label="Inspected" className="inv-num">{row.inspected}</td>
                      <td data-label="Passed" className="inv-num">{row.passed}</td>
                      <td data-label="Rework" className="inv-num">{row.rework}</td>
                      <td data-label="Rejected" className="inv-num">{row.rejected}</td>
                      <td data-label="Pass rate" className="inv-num">{passRate(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="inv-card">
        <div className="inv-card__header"><h2>Quality areas</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li><Link href="/quality/incoming">Incoming inspection</Link>: release or scrap stock on quality hold.</li>
          <li><Link href="/quality/in-process">In-process inspection</Link>: sampling records at stages 1–6.</li>
          <li><Link href="/quality/final">Final inspection</Link>: records the Quality Check stage of production orders.</li>
          <li><Link href="/quality/rejections">Rejections &amp; rework</Link>: inspections with failed quantities.</li>
          <li>NCR and CAPA: not implemented yet.</li>
        </ul>
      </section>
    </main>
  );
}
