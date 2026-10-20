import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createShipment, listShipments } from "@/server/dispatch/dispatch.service";
import { shipmentInputSchema, shipmentQuerySchema } from "@/server/dispatch/dispatch.validation";
import { parseBodyWithTypedLocation } from "@/server/inventory/typed-location";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "dispatch:view");
    return { data: await listShipments(parseQuery(request, shipmentQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "dispatch:create");
    // Ship-from can be typed by hand (D-048).
    const input = await parseBodyWithTypedLocation(request, shipmentInputSchema, user.id);
    return { data: await createShipment(input, user.id), status: 201 };
  });
}
