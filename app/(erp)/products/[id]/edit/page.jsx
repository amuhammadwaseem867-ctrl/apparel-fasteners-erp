import ProductEditor from "@/components/products/ProductEditor";

export default async function EditProductPage({ params }) {
  const { id } = await params;
  return <ProductEditor productId={id} />;
}

export const instant = false;
