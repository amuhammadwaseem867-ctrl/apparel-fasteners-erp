import InvoicePrintClient from "./InvoicePrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <InvoicePrintClient id={id} />;
}

export const instant = false;
