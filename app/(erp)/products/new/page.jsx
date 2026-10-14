import ProductEditor from "@/components/products/ProductEditor";

const PREFILL_KEYS = ["sku", "name", "category", "productType", "variant", "unit", "size", "material", "itemType", "finish", "logoType"];

/*
 * Optional query parameters prefill the form (used by the Item Master's
 * catalogue coverage list). Nothing is saved until the user submits.
 */
export default async function NewProductPage({ searchParams }) {
  const params = await searchParams;
  const initial = Object.fromEntries(
    PREFILL_KEYS
      .filter((key) => typeof params?.[key] === "string")
      .map((key) => [key, params[key].slice(0, 180)]),
  );

  return <ProductEditor initial={initial} />;
}

export const instant = false;
