import { authorizeAnyRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { listBuySuggestions } from "@/server/procurement/procurement.service";

/* Confirmed MRP BUY planned orders not yet on a requisition. */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["purchasing:view", "production:view"]);
    return { data: { suggestions: await listBuySuggestions() } };
  });
}
