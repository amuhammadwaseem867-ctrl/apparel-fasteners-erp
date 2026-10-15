import NcrClient from "@/components/quality/NcrClient";

export default async function NcrPage({ searchParams }) {
  const params = await searchParams;
  return <NcrClient initialNcr={params?.ncr ?? ""} />;
}

export const instant = false;
