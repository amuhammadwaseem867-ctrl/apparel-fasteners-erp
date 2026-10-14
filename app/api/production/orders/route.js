import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createProductionOrder, listProductionOrders } from "@/server/production/production.service";
import { productionOrderInputSchema, productionQuerySchema } from "@/server/production/production.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: await listProductionOrders(parseQuery(request, productionQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:create");
    const input = await parseRequestBody(request, productionOrderInputSchema);
    return { data: await createProductionOrder(input, user.id), status: 201 };
  });
}
