import BillClient from "@/components/procurement/BillClient";

export default async function BillPage({ params }) {
  const { id } = await params;
  return <BillClient id={id} />;
}

export const instant = false;
