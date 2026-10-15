import { redirect } from "next/navigation";

/* Packages are recorded on packing lists (see docs/ERP_MODULE_STATUS.md). */
export default function Page() {
  redirect("/packing/orders");
}
