import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getCustomerAccount } from "@/server/finance/customer-account.service";

/* One customer's orders, invoices, payments and ledger (D-052). */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getCustomerAccount(id) };
  });
}
