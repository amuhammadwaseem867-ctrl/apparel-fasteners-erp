import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
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
    // An incoming inspection's location can be typed by hand (D-048).
    const input = await parseBodyWithTypedLocation(request, inspectionInputSchema, user.id);
    return { data: await createInspection(input, user.id), status: 201 };
  });
}
