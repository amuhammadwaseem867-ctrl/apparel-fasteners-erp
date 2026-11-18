import CostingRecordPrintClient from "./CostingRecordPrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <CostingRecordPrintClient id={id} />;
}

export const instant = false;
