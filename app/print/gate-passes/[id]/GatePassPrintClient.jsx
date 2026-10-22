"use client";

/*
 * AF7 Inward / Outward Gate Pass (GET /api/gate-passes/[id]): document
 * information, material details with bags and weights, totals, and the
 * four signatures with the company stamp.
 */

import Link from "next/link";

import { Af7Fields, Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import { PASS_TYPES } from "@/components/gate/gatePassUi";
import useApiData from "@/lib/inventory/useApiData";
import { addDecimalStrings } from "@/server/core/utils/decimal";
import useCompany from "@/lib/useCompany";

/* Sum of the lines that give a value; blank when none does. */
function columnTotal(lines, field) {
  const given = lines.filter((line) => line[field] !== null && line[field] !== undefined);
  return given.length ? given.reduce((sum, line) => addDecimalStrings(sum, String(line[field])), "0") : "";
}

export default function GatePassPrintClient({ id }) {
  const company = useCompany();
  const { data: pass, error } = useApiData(`/api/gate-passes/${encodeURIComponent(id)}`);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/dispatch/gate-passes">Back to gate passes</Link></main>;
  if (!pass) return <main className="print-doc print-doc--message"><p role="status">Loading gate passâ€¦</p></main>;

  const inward = pass.passType === "INWARD";
  const units = [...new Set(pass.lines.map((line) => line.unit))];
  const weights = (line) => [line.netWeight, line.grossWeight].some((value) => value !== null) ? `${line.netWeight ?? "â€”"} / ${line.grossWeight ?? "â€”"}` : "";
  const net = columnTotal(pass.lines, "netWeight");
  const gross = columnTotal(pass.lines, "grossWeight");

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/dispatch/gate-passes/${pass.id}`}>Back to gate pass</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page
        company={company}
        title={<>INWARD / OUTWARD<br />GATE PASS</>}
        subtitle={(
          <div>
            <span className="af7__check"><i>{inward ? "âœ“" : ""}</i>INWARD</span>
            <span className="af7__check"><i>{inward ? "" : "âœ“"}</i>OUTWARD</span>
            {!inward && <p className="af7__small">{PASS_TYPES[pass.passType]}</p>}
          </div>
        )}
      >
        {pass.status === "DRAFT" && <p className="af7__notice">NOT APPROVED: goods may not pass the gate on this pass.</p>}
        {pass.status === "CANCELLED" && <p className="af7__notice">CANCELLED: this gate pass is void.</p>}

        <Af7Section number="1" title="Document information">
          <div className="af7__two">
            <Af7Fields rows={[["Date", new Date(pass.createdAt).toLocaleDateString("en-GB")], ["Gate pass no.", pass.passNumber], ["Reference no.", pass.referenceNo || pass.shipmentNumber]]} />
            <Af7Fields rows={[["M/s / party name", pass.partyName], ["Purpose", pass.purpose], ["Vehicle / driver", [pass.vehicleNumber, pass.driverName].filter(Boolean).join(" · ")], ...(pass.expectedReturnDate ? [["Return by", pass.expectedReturnDate]] : [])]} />
          </div>
        </Af7Section>

        <Af7Section number="2" title="Material details">
          <table className="af7__table">
            <colgroup>
              <col style={{ width: "8%" }} /><col style={{ width: "40%" }} /><col style={{ width: "16%" }} /><col style={{ width: "12%" }} /><col style={{ width: "24%" }} />
            </colgroup>
            <thead>
              <tr><th>Sr. no.</th><th>Product name</th><th>Quantity</th><th>No. of bags</th><th>Net weight / gross weight (kg)</th></tr>
            </thead>
            <tbody>
              {pass.lines.map((line) => (
                <tr key={line.id}>
                  <td className="center">{line.lineNo}</td>
                  <td>{line.description}</td>
                  <td className="num">{line.quantity} {line.unit}</td>
                  <td className="num">{line.bags ?? ""}</td>
                  <td className="num">{weights(line)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Af7Section>

        <Af7Section number="3" title="Totals">
          <div className="af7__three">
            <Af7Fields rows={[["Total quantity", units.length === 1 ? `${columnTotal(pass.lines, "quantity")} ${units[0]}` : units.length > 1 ? "Mixed units, see lines" : ""]]} />
            <Af7Fields rows={[["Total no. of bags", columnTotal(pass.lines, "bags")]]} />
            <Af7Fields rows={[["Total weight (kg)", net || gross ? `${net || "â€”"} / ${gross || "â€”"}` : ""]]} />
          </div>
        </Af7Section>

        {pass.passedAt && <p className="af7__small">Passed the gate {new Date(pass.passedAt).toLocaleString("en-GB")}{pass.guardName ? ` · guard ${pass.guardName}` : ""}</p>}
        <div className="af7__spacer" />
        <Af7Section number="4" title="Authorization / signature">
          <Af7Signatures roles={[["PREPARED BY", pass.createdByName], ["CHECKED BY"], ["AUTHORIZED SIGNATURE", pass.approvedByName], ["RECEIVER / DRIVER SIGNATURE", pass.driverName]]} />
        </Af7Section>
      </Af7Page>
    </main>
  );
}


