import CustomerLedgerPrintClient from "./CustomerLedgerPrintClient";

export default async function PrintPage({ params, searchParams }) {
  const { id } = await params;
  const { from = "", to = "" } = await searchParams;

  return <CustomerLedgerPrintClient id={id} from={from} to={to} />;
}

export const instant = false;
