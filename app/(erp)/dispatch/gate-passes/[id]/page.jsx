import GatePassClient from "./GatePassClient";

export default async function GatePassPage({ params }) {
  const { id } = await params;

  return <GatePassClient id={id} />;
}

export const instant = false;
