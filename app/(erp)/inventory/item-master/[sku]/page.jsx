import ItemProfileClient from "./ItemProfileClient";

export default async function ItemProfilePage({ params }) {
  const { sku } = await params;
  return <ItemProfileClient sku={sku} />;
}

// Sidebar/Topbar use usePathname(); allow blocking prerender for this route.
export const instant = false;

