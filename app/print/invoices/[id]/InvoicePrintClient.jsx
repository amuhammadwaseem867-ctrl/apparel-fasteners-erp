"use client";

/*
 * AF7 Sales Tax Invoice (GET /api/finance/invoices/[id]), laid out like the
 * company's template: consignee with NTN / STRN, invoice details with the
 * customer PO, item lines with finish, colour and size, GST totals,
 * commercial terms, shipment details and bank details from Settings.
 * A non sales tax invoice prints in AF7's own invoice layout instead:
 * consignee, item table with a quantity / amount total, bank detail and
 * terms, and no GST.
 */

import Link from "next/link";

import { Af7Fields, Af7Page, Af7Section, Af7Stamp } from "@/components/print/Af7Document";
import useApiData from "@/lib/inventory/useApiData";
import { formatAmount } from "@/lib/formatters/formatters";
import { addDecimalStrings, subtractDecimalStrings } from "@/server/core/utils/decimal";
import useCompany from "@/lib/useCompany";

const day = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

function StatusNotice({ invoice }) {
  if (invoice.status === "DRAFT") return <p className="af7__notice">DRAFT: not issued. This is not a valid invoice.</p>;
  if (invoice.status === "CANCELLED") return <p className="af7__notice">CANCELLED: this invoice is void.</p>;
  return null;
}

function NonTaxInvoice({ invoice, company, paymentTerms }) {
  const totalQuantity = invoice.lines.reduce((sum, line) => addDecimalStrings(sum, line.quantity), "0");
  const total = subtractDecimalStrings(invoice.subtotal, invoice.discountTotal);
  return (
    <Af7Page
      company={company}
      title="PROFORMA INVOICE"
      subtitle={<Af7Fields rows={[["INV #", invoice.invoiceNumber], ["Dated", day(invoice.invoiceDate)]]} />}
    >
      <StatusNotice invoice={invoice} />

      <Af7Section title="Consignee">
        <Af7Fields rows={[
          ["Consignee", invoice.customerName],
          ["Address", invoice.customerAddress],
          ["Contact #", invoice.customerPhone],
          ["Contact person", invoice.customerContactPerson],
        ]} />
      </Af7Section>

      <Af7Section title="Items">
        <table className="af7__table">
          <colgroup>
            <col style={{ width: "30%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "8%" }} /><col style={{ width: "7%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} /><col style={{ width: "13%" }} />
          </colgroup>
          <thead>
            <tr><th>Description</th><th>Tape color</th><th>Finish</th><th>Size</th><th>Unit</th><th>Quantity</th><th>Unit price</th><th>Total amount</th></tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}{Number(line.discountPercent) > 0 ? ` (less ${line.discountPercent}%)` : ""}</td>
                <td>{line.color ?? ""}</td>
                <td>{line.finish ?? ""}</td>
                <td>{line.size ?? ""}</td>
                <td className="center">{line.unit}</td>
                <td className="num">{line.quantity}</td>
                <td className="num">{line.unitPrice}</td>
                <td className="num">{formatAmount(subtractDecimalStrings(line.grossAmount, line.discountAmount))}</td>
              </tr>
            ))}
            <tr className="af7__strong">
              <th colSpan={5}>Total</th>
              <td className="num">{totalQuantity}</td>
              <td />
              <td className="num">{formatAmount(total)}</td>
            </tr>
          </tbody>
        </table>
        {invoice.status === "ISSUED" && (Number(invoice.credited) > 0 || Number(invoice.received) > 0) && (
          <p>Credited {formatAmount(invoice.credited)} · received {formatAmount(invoice.received)} · balance due {formatAmount(invoice.outstanding)}</p>
        )}
      </Af7Section>

      <div className="af7__two">
        <Af7Section title="Bank detail">
          <Af7Fields rows={[
            ["Bank name", company.bankName],
            ["Account title", company.accountName],
            ["Account no.", company.accountNumber],
            ["IBAN", company.iban],
            ["Branch / address", company.bankBranch],
            ["NTN #", company.taxRegistration],
          ]} />
        </Af7Section>
        <Af7Section title="Terms">
          <Af7Fields rows={[
            ["Production time", company.productionTime],
            ["Payment term", paymentTerms],
            ["Shipment term", company.shipmentTerms],
            ["Shipment mode", company.shipmentMode],
            ["Port of loading", company.portOfLoading],
            ["Port of discharge", ""],
            ["Country of origin", company.countryOfOrigin],
            ["HS code", company.hsCode],
          ]} />
        </Af7Section>
      </div>

      <div className="af7__spacer" />
      <div className="af7__bank">
        <p><strong>THANK YOU FOR YOUR BUSINESS</strong></p>
        <div className="af7__signature">
          <strong>AUTHORIZED SIGNATORY</strong>
          <span className="af7__sign-line">Signature</span>
        </div>
        <Af7Stamp />
      </div>
      {invoice.notes && <p><strong>Notes:</strong> {invoice.notes}</p>}
    </Af7Page>
  );
}

export default function InvoicePrintClient({ id }) {
  const company = useCompany();
  const { data: invoice, error } = useApiData(`/api/finance/invoices/${encodeURIComponent(id)}`);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/finance/invoices">Back to invoices</Link></main>;
  if (!invoice) return <main className="print-doc print-doc--message"><p role="status">Loading invoice…</p></main>;

  // Before GST = goods after discount; the GST is the invoice's own tax.
  const beforeGst = subtractDecimalStrings(invoice.subtotal, invoice.discountTotal);
  const rates = [...new Set(invoice.lines.map((line) => line.taxPercent))];
  const gstLabel = rates.length === 1 ? `GST ${rates[0]}%` : "GST";
  const paymentTerms = company.paymentTerms || (invoice.paymentTermsDays ? `${invoice.paymentTermsDays} days from invoice date` : "");

  const toolbar = (
    <nav className="print-doc__toolbar" aria-label="Document actions">
      <Link href={`/finance/invoices/${invoice.id}`}>Back to invoice</Link>
      <button type="button" onClick={() => window.print()}>Print</button>
    </nav>
  );

  if (invoice.invoiceType === "NON_TAX") {
    return <main className="print-doc">{toolbar}<NonTaxInvoice invoice={invoice} company={company} paymentTerms={paymentTerms} /></main>;
  }

  return (
    <main className="print-doc">
      {toolbar}
      <Af7Page
        company={company}
        title="SALES TAX INVOICE"
        subtitle={<Af7Fields rows={[["Invoice no.", invoice.invoiceNumber], ["Date", day(invoice.invoiceDate)]]} />}
      >
        <StatusNotice invoice={invoice} />

        <div className="af7__two">
          <Af7Section title="Consignee">
            <Af7Fields rows={[
              ["Customer PO #", invoice.customerPo],
              ["Consignee", invoice.customerName],
              ["Address", invoice.customerAddress],
              ["Contact #", invoice.customerPhone],
              ["Contact person", invoice.customerContactPerson],
              ["NTN #", invoice.customerNtn],
              ["STRN #", invoice.customerStrn],
            ]} />
          </Af7Section>
          <Af7Section title="Invoice details">
            <Af7Fields rows={[
              ["Date", day(invoice.invoiceDate)],
              ["Order no.", invoice.salesOrderNumber],
              ["Delivery challan", invoice.shipmentNumber],
              ["Due date", day(invoice.dueDate)],
              ["NTN #", invoice.companyNtn],
            ]} />
          </Af7Section>
        </div>

        <Af7Section title="Product / item details">
          <table className="af7__table">
            <colgroup>
              <col style={{ width: "5%" }} /><col style={{ width: "29%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "8%" }} /><col style={{ width: "6%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr><th>#</th><th>Product description</th><th>Finish</th><th>Color</th><th>Size</th><th>Unit</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="center">{line.lineNo}</td>
                  <td>{line.description}{Number(line.discountPercent) > 0 ? ` (less ${line.discountPercent}%)` : ""}</td>
                  <td>{line.finish ?? ""}</td>
                  <td>{line.color ?? ""}</td>
                  <td>{line.size ?? ""}</td>
                  <td className="center">{line.unit}</td>
                  <td className="num">{line.quantity}</td>
                  <td className="num">{line.unitPrice}</td>
                  <td className="num">{formatAmount(subtractDecimalStrings(line.grossAmount, line.discountAmount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="af7__totals">
            <tbody>
              <tr><th>Total amount before GST</th><td>{formatAmount(beforeGst)}</td></tr>
              <tr><th>{gstLabel}</th><td>{formatAmount(invoice.taxTotal)}</td></tr>
              <tr className="af7__strong"><th>Total amount including GST</th><td>{formatAmount(addDecimalStrings(beforeGst, invoice.taxTotal))}</td></tr>
            
            </tbody>
          </table>
          {invoice.status === "ISSUED" && (Number(invoice.credited) > 0 || Number(invoice.received) > 0) && (
            <p>Credited {formatAmount(invoice.credited)} · received {formatAmount(invoice.received)} · balance due {formatAmount(invoice.outstanding)}</p>
          )}
        </Af7Section>

        <div className="af7__two">
          <Af7Section title="Commercial terms">
            <Af7Fields rows={[["Production time", company.productionTime], ["Payment terms", paymentTerms], ["Shipment terms", company.shipmentTerms], ["Shipment mode", company.shipmentMode]]} />
          </Af7Section>
          <Af7Section title="Shipment details">
            <Af7Fields rows={[["Port of loading", company.portOfLoading], ["Port of discharge", ""], ["Country of origin", company.countryOfOrigin]]} />
          </Af7Section>
        </div>

        <div className="af7__spacer" />
        <Af7Section title="Bank / payment details">
          <div className="af7__bank">
            <Af7Fields rows={[["Bank name", company.bankName], ["Account name", company.accountName], ["Account no.", company.accountNumber], ["IBAN", company.iban], ["SWIFT code", company.swiftCode], ["Branch / address", company.bankBranch]]} />
            <Af7Stamp />
            <div className="af7__signature">
              <strong>CUSTOMER ACKNOWLEDGEMENT</strong>
              <span className="af7__sign-line">Signature</span>
            </div>
          </div>
        </Af7Section>
        {invoice.notes && <p><strong>Notes:</strong> {invoice.notes}</p>}
      </Af7Page>
    </main>
  );
}

