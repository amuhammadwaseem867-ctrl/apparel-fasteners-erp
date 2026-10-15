import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createPackingList, listPackingLists } from "@/server/packing/packing.service";
import { packingListInputSchema, packingQuerySchema } from "@/server/packing/packing.validation";

/* Packing uses the production permissions (D-022). */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: await listPackingLists(parseQuery(request, packingQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const input = await parseRequestBody(request, packingListInputSchema);
    return { data: await createPackingList(input, user.id), status: 201 };
  });
}
