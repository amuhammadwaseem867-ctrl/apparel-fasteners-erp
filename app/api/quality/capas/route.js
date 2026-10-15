import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createCapa, listCapas } from "@/server/quality/ncr.service";
import { capaInputSchema, ncrQuerySchema } from "@/server/quality/ncr.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "quality:view");
    return { data: await listCapas(parseQuery(request, ncrQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "quality:create");
    return { data: await createCapa(await parseRequestBody(request, capaInputSchema), user.id), status: 201 };
  });
}
