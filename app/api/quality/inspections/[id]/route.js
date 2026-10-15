import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { decideInspection, getInspection } from "@/server/quality/quality.service";
import { inspectionDecisionSchema } from "@/server/quality/quality.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "quality:view");
    const { id } = await params;
    return { data: await getInspection(id) };
  });
}

/* PATCH { action: approve | cancel, note? }: applies the results once (quality:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "quality:approve");
    const { action, note } = await parseRequestBody(request, inspectionDecisionSchema);
    const { id } = await params;
    return { data: await decideInspection(id, action, note ?? "", user.id) };
  });
}
