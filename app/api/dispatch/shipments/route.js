import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createShipment, listShipments } from "@/server/dispatch/dispatch.service";
import { shipmentInputSchema, shipmentQuerySchema } from "@/server/dispatch/dispatch.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "dispatch:view");
    return { data: await listShipments(parseQuery(request, shipmentQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "dispatch:create");
    const input = await parseRequestBody(request, shipmentInputSchema);
    return { data: await createShipment(input, user.id), status: 201 };
  });
}
