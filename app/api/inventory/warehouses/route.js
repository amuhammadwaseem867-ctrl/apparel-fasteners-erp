import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createWarehouse, listWarehouses } from "@/server/inventory/inventory.service";
import { warehouseInputSchema, warehouseQuerySchema } from "@/server/inventory/inventory.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await listWarehouses(parseQuery(request, warehouseQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const input = await parseRequestBody(request, warehouseInputSchema);
    return { data: await createWarehouse(input, user.id), status: 201 };
  });
}
