import ItemProfileClient from "./ItemProfileClient";

export const instant = false;

export default async function ItemProfilePage({ params }) {
  const { sku } = await params;

  return <ItemProfileClient sku={sku} />;
}