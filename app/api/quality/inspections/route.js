import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { bestStockLocation } from "@/server/inventory/inventory.service";
import { parseBodyWithTypedLocation } from "@/server/inventory/typed-location";
import { createInspection, listInspections } from "@/server/quality/quality.service";
import { inspectionInputSchema, inspectionQuerySchema } from "@/server/quality/quality.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "quality:view");
    return { data: await listInspections(parseQuery(request, inspectionQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "quality:create");
    // An incoming inspection's location can be typed by hand (D-048) or left
    // out: then the location holding the item on quality hold (D-053).
    // Inspections of a production order need no location.
    const input = await parseBodyWithTypedLocation(request, inspectionInputSchema, user.id, async (body) => (
      body.inspectionType === "INCOMING" && typeof body.productId === "string"
        ? bestStockLocation(body.productId, user.id, "qualityHold")
        : ""
    ));
    return { data: await createInspection(input, user.id), status: 201 };
  });
}
