import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listBalances } from "@/server/inventory/inventory.service";
import { balanceQuerySchema } from "@/server/inventory/inventory.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await listBalances(parseQuery(request, balanceQuerySchema)) };
  });
}
