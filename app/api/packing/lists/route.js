import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { parseBodyWithTypedLocation } from "@/server/inventory/typed-location";
import { createPackingList, listPackingLists } from "@/server/packing/packing.service";
import { packingListInputSchema, packingQuerySchema } from "@/server/packing/packing.validation";

/* Packing uses the production permissions (D-022). */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: await listPackingLists(parseQuery(request, packingQuerySchema)) };
  });
}

/* The location can be typed ("FG Shelf 2"); it is found or created once the rest is valid (D-047). */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const input = await parseBodyWithTypedLocation(request, packingListInputSchema, user.id);
    return { data: await createPackingList(input, user.id), status: 201 };
  });
}
