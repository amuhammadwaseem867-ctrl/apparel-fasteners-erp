import OrderSheetForm from "@/components/orders/OrderSheetForm";

export default async function EditInvoicePage({ params }) {
  const { id } = await params;

  return <OrderSheetForm mode="invoice" invoiceId={id} />;
}

export const instant = false;
