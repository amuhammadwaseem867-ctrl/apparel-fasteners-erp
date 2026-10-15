import GoodsReceiptsClient from "@/components/procurement/GoodsReceiptsClient";

export default async function GoodsReceiptsPage({ searchParams }) {
  const params = await searchParams;
  return <GoodsReceiptsClient initialReceipt={params?.receipt ?? ""} />;
}

export const instant = false;
