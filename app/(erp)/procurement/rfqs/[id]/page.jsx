import RfqClient from "@/components/procurement/RfqClient";

export default async function RfqPage({ params }) {
  const { id } = await params;
  return <RfqClient id={id} />;
}

export const instant = false;
