import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createPlan, listPlans } from "@/server/planning/scheduling.service";
import { listSchema, planInputSchema } from "@/server/planning/scheduling.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: await listPlans(parseQuery(request, listSchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:create");
    return { data: await createPlan(await parseRequestBody(request, planInputSchema), user.id), status: 201 };
  });
}
