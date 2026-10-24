import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createShortfall, listShortfalls } from "@/server/sales/shortfall.service";
import { shortfallInputSchema, shortfallQuerySchema } from "@/server/sales/shortfall.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    return { data: await listShortfalls(parseQuery(request, shortfallQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:update");
    const input = await parseRequestBody(request, shortfallInputSchema);
    return { data: await createShortfall(input, user.id), status: 201 };
  });
}
