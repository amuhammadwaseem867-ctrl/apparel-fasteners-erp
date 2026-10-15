import PurchaseOrderPrintClient from "./PurchaseOrderPrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <PurchaseOrderPrintClient id={id} />;
}

export const instant = false;
