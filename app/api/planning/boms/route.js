import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createBom, listBoms } from "@/server/planning/bom.service";
import { bomInputSchema, bomQuerySchema } from "@/server/planning/planning.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: await listBoms(parseQuery(request, bomQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:create");
    const input = await parseRequestBody(request, bomInputSchema);
    return { data: await createBom(input, user.id), status: 201 };
  });
}
