import RequisitionClient from "@/components/procurement/RequisitionClient";

export default async function RequisitionPage({ params }) {
  const { id } = await params;
  return <RequisitionClient id={id} />;
}

export const instant = false;
