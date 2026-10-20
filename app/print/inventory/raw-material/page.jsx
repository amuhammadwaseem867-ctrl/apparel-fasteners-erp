import RawMaterialPrintClient from "./RawMaterialPrintClient";

export default async function RawMaterialPrintPage({ searchParams }) {
  const params = await searchParams;

  return <RawMaterialPrintClient params={params} />;
}

export const instant = false;
