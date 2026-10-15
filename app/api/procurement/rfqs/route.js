import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createRfq, listRfqs } from "@/server/procurement/procurement.service";
import { listQuerySchema, rfqInputSchema } from "@/server/procurement/procurement.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "purchasing:view");
    return { data: await listRfqs(parseQuery(request, listQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:create");
    return { data: await createRfq(await parseRequestBody(request, rfqInputSchema), user.id), status: 201 };
  });
}
