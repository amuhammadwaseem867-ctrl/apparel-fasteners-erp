import OrderPackingPrintClient from "./OrderPackingPrintClient";

export default async function OrderPackingPrintPage({ params }) {
  const { id } = await params;

  return <OrderPackingPrintClient id={id} />;
}

export const instant = false;
