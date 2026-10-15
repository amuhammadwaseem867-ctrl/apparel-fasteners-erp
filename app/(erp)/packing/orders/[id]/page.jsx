import PackingListClient from "./PackingListClient";

export default async function PackingListPage({ params }) {
  const { id } = await params;

  return <PackingListClient id={id} />;
}

export const instant = false;
