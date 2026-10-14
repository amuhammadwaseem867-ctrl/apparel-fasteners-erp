import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createLocation, listLocations } from "@/server/inventory/inventory.service";
import { locationInputSchema, locationQuerySchema } from "@/server/inventory/inventory.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await listLocations(parseQuery(request, locationQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const input = await parseRequestBody(request, locationInputSchema);
    return { data: await createLocation(input, user.id), status: 201 };
  });
}
