import OrderSheetForm from "@/components/orders/OrderSheetForm";

/* Orders are made from the invoice (D-048): a new order is a new invoice. */
export default function NewSalesOrderPage() {
  return <OrderSheetForm mode="invoice" />;
}
