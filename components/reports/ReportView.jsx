"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { downloadFile } from "@/lib/api/client";
import { formatAmount } from "@/lib/formatters/formatters";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function isoDaysAgo(days) {
  const date = new Date(Date.now() - days * 86400000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function cell(column, row) {
  const value = row[column.key];
  if (value === "" || value === undefined || value === null) return "—";
  if (column.type === "money") return formatAmount(value);
  if (column.type === "percent") return `${value}%`;
  if (column.type === "datetime") return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  if (column.type === "number") return value;
  return value;
}

function link(column, row) {
  if (!column.href) return null;
  const href = column.href.replace(/\{(\w+)\}/g, (_match, key) => encodeURIComponent(row[key] ?? ""));
  return href.includes("//") || href.endsWith("/") ? null : href;
}

/*
 * Renders one server report (GET /api/reports/[report]) with a date range
 * and CSV export of exactly the rows shown. Totals come from the server.
 */
export default function ReportView({ report, eyebrow = "Reports", backHref = "/reports" }) {
  const [from, setFrom] = useState(() => isoDaysAgo(89));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const query = toQuery({ from, to });
  const result = useApiData(`/api/reports/${report}${query}`);
  const data = result.data;
  const totals = data?.totals ?? {};
  const hasTotals = Object.keys(totals).length > 0 && data?.rows?.length > 0;

  async function exportCsv() {
    setDownloading(true);
    setError("");
    try {
      // Export exactly the range of the rows on screen.
      const range = data?.dated ? { from: data.from, to: data.to } : {};
      await downloadFile(`/api/reports/${report}${toQuery({ ...range, format: "csv" })}`, `${report}.csv`);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href={backHref}>{eyebrow}</Link></p>
          <h1>{data?.title ?? "Report"}</h1>
          <p>{data?.description ?? ""}</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="secondary" loading={downloading} disabled={!data || !data.rows.length} onClick={exportCsv}>Export CSV</Button>
          <button type="button" className="inv-link-button" onClick={() => window.print()} disabled={!data}>Print</button>
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        {(data?.dated ?? true) && (
          <div className="inv-toolbar">
            <div className="inv-field"><label htmlFor="rp-from">From</label><input id="rp-from" type="date" max={to} value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="inv-field"><label htmlFor="rp-to">To</label><input id="rp-to" type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></div>
          </div>
        )}
        {result.error ? (
          <p className="inv-state inv-state--error" role="alert">{result.error}</p>
        ) : !data ? (
          <p className="inv-state" role="status">Loading report…</p>
        ) : data.rows.length === 0 ? (
          <p className="inv-state">No data{data.dated ? ` between ${data.from} and ${data.to}` : ""}.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>{data.columns.map((column) => <th key={column.key} className={["number", "money", "percent"].includes(column.type) ? "inv-num" : ""}>{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr key={`${row.id ?? ""}-${index}`}>
                    {data.columns.map((column) => {
                      const href = link(column, row);
                      const content = cell(column, row);
                      return (
                        <td key={column.key} data-label={column.label} className={["number", "money", "percent"].includes(column.type) ? "inv-num" : ""}>
                          {href ? <Link href={href}>{content}</Link> : content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {hasTotals && (
                  <tr>
                    {data.columns.map((column, index) => (
                      <td key={column.key} data-label={column.label} className={["number", "money", "percent"].includes(column.type) ? "inv-num" : ""}>
                        <strong>{index === 0 ? `Total (${data.rows.length} rows)` : totals[column.key] === undefined ? "" : column.type === "money" ? formatAmount(totals[column.key]) : totals[column.key]}</strong>
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <p className="inv-field__hint" style={{ padding: "8px 18px" }}>
            {data.note ? `${data.note} ` : ""}Generated {new Date(data.generatedAt).toLocaleString("en-GB")} from live records.
          </p>
        )}
      </section>
    </main>
  );
}
