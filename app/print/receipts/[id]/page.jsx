import ReceiptPrintClient from "./ReceiptPrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <ReceiptPrintClient id={id} />;
}

export const instant = false;
