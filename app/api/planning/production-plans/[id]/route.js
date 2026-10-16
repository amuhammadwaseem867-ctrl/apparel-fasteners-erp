import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { cancelPlanLine, changePlan, getPlan, releasePlanLine, updatePlanLines } from "@/server/planning/scheduling.service";
import { planActionSchema, planUpdateSchema } from "@/server/planning/scheduling.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { id } = await params;
    return { data: await getPlan(id) };
  });
}

/* PUT replaces a draft plan's header and lines (production:create). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:create");
    const input = await parseRequestBody(request, planUpdateSchema);
    const { id } = await params;
    return { data: await updatePlanLines(id, input, user.id) };
  });
}

/* PATCH { action, lineId }: approve/close/cancel the plan or release/cancel a line (production:update). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const { action, lineId } = await parseRequestBody(request, planActionSchema);
    const { id } = await params;
    if (action === "release-line") return { data: await releasePlanLine(id, lineId, user.id) };
    if (action === "cancel-line") return { data: await cancelPlanLine(id, lineId, user.id) };
    return { data: await changePlan(id, action, user.id) };
  });
}
