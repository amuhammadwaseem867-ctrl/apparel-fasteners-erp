import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { getCustomerLedger } from "@/server/finance/customer-account.service";
import { ledgerQuerySchema } from "@/server/finance/finance.validation";

/* The customer's ledger (khata) with a running balance; ?from=&to= for a period. */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getCustomerLedger(id, parseQuery(request, ledgerQuerySchema)) };
  });
}
