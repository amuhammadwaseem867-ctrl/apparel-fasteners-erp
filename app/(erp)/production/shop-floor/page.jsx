import { redirect } from "next/navigation";

/* Superseded by /production/stage-board (see docs/ERP_MODULE_STATUS.md). */
export default function Page() {
  redirect("/production/stage-board");
}
