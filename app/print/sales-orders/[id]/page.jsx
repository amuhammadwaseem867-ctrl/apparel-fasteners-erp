import SalesOrderSheetClient from "./SalesOrderSheetClient";

export default async function SalesOrderSheetPage({ params }) {
  const { id } = await params;

  return <SalesOrderSheetClient id={id} />;
}

export const instant = false;
