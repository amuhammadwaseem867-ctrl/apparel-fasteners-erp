"use client";

import { PRODUCTION_STAGES } from "@/config/production";

const DESCRIPTION = Object.fromEntries(PRODUCTION_STAGES.map((stage) => [stage.key, stage]));

function lossRate(row) {
  const processed = Number(row.processed);
  if (!processed) return "—";
  return `${(((Number(row.rejected) + Number(row.wastage)) / processed) * 100).toFixed(1)}%`;
}

/*
 * Per-stage totals from GET /api/production/summary: orders currently at
 * the stage and quantities processed, rejected and wasted across all
 * non-cancelled orders. The loss rate is display-only (rounded), never
 * stored or used in calculations.
 */
export default function StageTotalsTable({ stages, showDescription = false }) {
  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <thead>
          <tr>
            <th className="inv-num">#</th><th>Stage</th>{showDescription && <th>Department / work</th>}
            <th className="inv-num">Active orders</th><th className="inv-num">Processed</th><th className="inv-num">Rejected</th>
            <th className="inv-num">Wastage</th><th className="inv-num">Loss rate</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((row, index) => (
            <tr key={row.key}>
              <td data-label="#" className="inv-num">{index + 1}</td>
              <td data-label="Stage"><strong>{row.label}</strong></td>
              {showDescription && <td data-label="Department / work">{DESCRIPTION[row.key]?.department}<small>{DESCRIPTION[row.key]?.description}</small></td>}
              <td data-label="Active orders" className="inv-num">{row.activeOrders}</td>
              <td data-label="Processed" className="inv-num">{row.processed}</td>
              <td data-label="Rejected" className="inv-num">{row.rejected}</td>
              <td data-label="Wastage" className="inv-num">{row.wastage}</td>
              <td data-label="Loss rate" className="inv-num">{lossRate(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
