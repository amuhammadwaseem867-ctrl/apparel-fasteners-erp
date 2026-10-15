import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeCapa, getCapa } from "@/server/quality/ncr.service";
import { capaActionSchema } from "@/server/quality/ncr.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "quality:view");
    const { id } = await params;
    return { data: await getCapa(id) };
  });
}

/* PATCH { action, note }: start/complete (quality:create); verify/reopen/cancel (quality:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const { action, note } = await parseRequestBody(request, capaActionSchema);
    const user = await authorizeRequest(request, ["start", "complete"].includes(action) ? "quality:create" : "quality:approve");
    const { id } = await params;
    return { data: await changeCapa(id, action, note ?? "", user.id) };
  });
}
