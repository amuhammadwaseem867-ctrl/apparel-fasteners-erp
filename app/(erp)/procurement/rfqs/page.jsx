import RfqsClient from "@/components/procurement/RfqsClient";

export default async function RfqsPage({ searchParams }) {
  const params = await searchParams;
  return <RfqsClient initialStatus={params?.status ?? ""} />;
}

export const instant = false;
