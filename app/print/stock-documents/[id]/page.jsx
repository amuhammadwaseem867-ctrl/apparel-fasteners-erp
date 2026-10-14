import StockDocumentSlipClient from "./StockDocumentSlipClient";

export default async function StockDocumentSlipPage({ params }) {
  const { id } = await params;

  return <StockDocumentSlipClient id={id} />;
}

export const instant = false;
