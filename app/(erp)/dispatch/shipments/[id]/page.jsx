import ShipmentClient from "./ShipmentClient";

export default async function ShipmentPage({ params }) {
  const { id } = await params;

  return <ShipmentClient id={id} />;
}

export const instant = false;
