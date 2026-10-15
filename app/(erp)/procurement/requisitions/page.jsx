import RequisitionsClient from "@/components/procurement/RequisitionsClient";

export default async function RequisitionsPage({ searchParams }) {
  const params = await searchParams;
  return <RequisitionsClient initialStatus={params?.status ?? ""} openMrp={params?.new === "mrp"} />;
}

export const instant = false;
