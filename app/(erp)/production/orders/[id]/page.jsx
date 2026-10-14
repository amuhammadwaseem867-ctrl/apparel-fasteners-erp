import ProductionOrderClient from "./ProductionOrderClient";

export default async function ProductionOrderPage({ params }) {
  const { id } = await params;

  return <ProductionOrderClient id={id} />;
}

export const instant = false;
