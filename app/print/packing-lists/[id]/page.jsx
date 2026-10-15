import PackingListPrintClient from "./PackingListPrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <PackingListPrintClient id={id} />;
}

export const instant = false;
