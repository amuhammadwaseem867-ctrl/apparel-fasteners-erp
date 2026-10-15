import PurchaseOrderClient from "@/components/procurement/PurchaseOrderClient";

export default async function PurchaseOrderPage({ params }) {
  const { id } = await params;
  return <PurchaseOrderClient id={id} />;
}

export const instant = false;
