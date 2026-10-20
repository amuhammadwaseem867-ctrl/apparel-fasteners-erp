import StockCardPrintClient from "./StockCardPrintClient";

export default async function StockCardPrintPage({ params, searchParams }) {
  const { id } = await params;
  const range = await searchParams;

  return <StockCardPrintClient id={id} range={{ dateFrom: range.dateFrom ?? "", dateTo: range.dateTo ?? "" }} />;
}

export const instant = false;
