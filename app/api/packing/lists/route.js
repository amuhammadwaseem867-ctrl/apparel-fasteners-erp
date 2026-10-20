import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { resolveTypedLocation } from "@/server/inventory/inventory.service";
import { createPackingList, listPackingLists } from "@/server/packing/packing.service";
import { packingListInputSchema, packingListRequestSchema, packingQuerySchema } from "@/server/packing/packing.validation";

/* Packing uses the production permissions (D-022). */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: await listPackingLists(parseQuery(request, packingQuerySchema)) };
  });
}

/*
 * The location can be typed ("FG Shelf 2"); it is found or created once the
 * rest of the packing list is valid, so a rejected list creates nothing.
 */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const { locationName, ...body } = await parseRequestBody(request, packingListRequestSchema);
    const check = (locationId) => {
      const parsed = packingListInputSchema.safeParse({ ...body, locationId });
      if (!parsed.success) {
        throw new AppError("Invalid packing list.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
      }
      return parsed.data;
    };
    check(body.locationId ?? "00000000-0000-4000-8000-000000000001");
    const input = check(body.locationId ?? await resolveTypedLocation(locationName, user.id));
    return { data: await createPackingList(input, user.id), status: 201 };
  });
}
