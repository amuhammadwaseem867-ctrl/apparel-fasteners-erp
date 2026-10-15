import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createNcr, listNcrs } from "@/server/quality/ncr.service";
import { ncrInputSchema, ncrQuerySchema } from "@/server/quality/ncr.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "quality:view");
    return { data: await listNcrs(parseQuery(request, ncrQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "quality:create");
    return { data: await createNcr(await parseRequestBody(request, ncrInputSchema), user.id), status: 201 };
  });
}
