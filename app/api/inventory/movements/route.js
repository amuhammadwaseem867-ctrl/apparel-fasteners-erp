import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listMovements } from "@/server/inventory/inventory.service";
import { movementQuerySchema } from "@/server/inventory/inventory.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await listMovements(parseQuery(request, movementQuerySchema)) };
  });
}
