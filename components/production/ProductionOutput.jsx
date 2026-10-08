"use client";

import Link from "next/link";
import {
  PackageCheck,
  ArrowRight,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

import "./ProductionOutput.css";

export default function ProductionOutput({
  outputs = [],
  href = "/production/output",
}) {
  return (
    <section className="production-output">
      <div className="production-output__header">
        <div>
          <span className="production-output__eyebrow">
            Output
          </span>

          <h2>Production Output</h2>

          <p>
            Recent production quantities recorded from the shop floor.
          </p>
        </div>

        <Link
          href={href}
          className="production-output__view-all"
        >
          View output
          <ArrowRight size={15} />
        </Link>
      </div>

      {outputs.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No production output"
          description="Recorded production output will appear here after production entries are posted."
          size="small"
        />
      ) : (
        <div className="production-output__table-wrap">
          <table className="production-output__table">
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Product</th>
                <th>Produced</th>
                <th>Rejected</th>
                <th>Good Output</th>
                <th>Recorded At</th>
              </tr>
            </thead>

            <tbody>
              {outputs.map((output) => (
                <tr key={output.id || output.code}>
                  <td>
                    <strong>
                      {output.workOrder || "—"}
                    </strong>
                  </td>

                  <td>
                    {output.productName || "—"}
                  </td>

                  <td>
                    {output.produced ?? "—"}
                  </td>

                  <td>
                    {output.rejected ?? "—"}
                  </td>

                  <td className="production-output__good">
                    {output.goodOutput ?? "—"}
                  </td>

                  <td>
                    {output.recordedAt || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}