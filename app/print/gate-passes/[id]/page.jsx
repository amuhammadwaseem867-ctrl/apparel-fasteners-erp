import GatePassPrintClient from "./GatePassPrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <GatePassPrintClient id={id} />;
}

export const instant = false;
