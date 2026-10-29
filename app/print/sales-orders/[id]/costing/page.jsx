import OrderCostingPrintClient from "./OrderCostingPrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <OrderCostingPrintClient id={id} />;
}

export const instant = false;
