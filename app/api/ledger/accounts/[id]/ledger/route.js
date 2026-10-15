import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { getAccountLedger } from "@/server/ledger/ledger.service";
import { rangeQuerySchema } from "@/server/ledger/ledger.validation";

/* Account statement: opening balance, lines and running balance. */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { from, to } = parseQuery(request, rangeQuerySchema);
    const { id } = await params;
    const end = to || new Date().toISOString().slice(0, 10);
    return { data: await getAccountLedger(id, from || `${end.slice(0, 4)}-01-01`, end) };
  });
}
