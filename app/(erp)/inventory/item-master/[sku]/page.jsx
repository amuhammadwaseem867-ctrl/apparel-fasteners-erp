import ItemProfileClient from "./ItemProfileClient";

export default async function ItemProfilePage({ params }) {
  const { sku } = await params;
  return <ItemProfileClient sku={sku} />;
}

export const instant = false;

