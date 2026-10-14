import ProductionJobCardClient from "./ProductionJobCardClient";

export default async function ProductionJobCardPage({ params }) {
  const { id } = await params;

  return <ProductionJobCardClient id={id} />;
}

export const instant = false;
