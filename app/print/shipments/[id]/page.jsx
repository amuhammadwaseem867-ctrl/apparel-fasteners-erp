import DeliveryChallanClient from "./DeliveryChallanClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <DeliveryChallanClient id={id} />;
}

export const instant = false;
