import { redirect } from "next/navigation";

/* Superseded by /production/orders (see docs/ERP_MODULE_STATUS.md). */
export default function Page() {
  redirect("/production/orders");
}
