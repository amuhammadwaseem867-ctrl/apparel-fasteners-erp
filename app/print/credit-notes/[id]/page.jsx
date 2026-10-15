import CreditNotePrintClient from "./CreditNotePrintClient";

export default async function PrintPage({ params }) {
  const { id } = await params;

  return <CreditNotePrintClient id={id} />;
}

export const instant = false;
