import PurchaseOrdersClient from "@/components/procurement/PurchaseOrdersClient";

export default async function PurchaseOrdersPage({ searchParams }) {
  const params = await searchParams;
  return <PurchaseOrdersClient initialStatus={params?.status ?? ""} />;
}

export const instant = false;
