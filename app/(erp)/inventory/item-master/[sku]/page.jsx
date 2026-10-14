import ItemProfileClient from "./ItemProfileClient";

export const instant = false;

/* The segment carries the item id; an older SKU link is resolved by SKU. */
export default async function ItemProfilePage({ params }) {
  const { sku } = await params;

  return <ItemProfileClient itemRef={decodeURIComponent(sku)} />;
}
