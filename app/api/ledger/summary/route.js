import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getLedgerSummary } from "@/server/ledger/ledger.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: await getLedgerSummary() };
  });
}
