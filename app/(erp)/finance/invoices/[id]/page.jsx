import InvoiceClient from "./InvoiceClient";

export default async function InvoicePage({ params }) {
  const { id } = await params;

  return <InvoiceClient id={id} />;
}

export const instant = false;
