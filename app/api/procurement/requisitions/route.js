import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createRequisition, listRequisitions } from "@/server/procurement/procurement.service";
import { listQuerySchema, requisitionInputSchema } from "@/server/procurement/procurement.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "purchasing:view");
    return { data: await listRequisitions(parseQuery(request, listQuerySchema)) };
  });
}

/* Purchasing and planners (production:update, for MRP buy suggestions) can raise requisitions. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeAnyRequest(request, ["purchasing:create", "production:update"]);
    return { data: await createRequisition(await parseRequestBody(request, requisitionInputSchema), user.id), status: 201 };
  });
}
