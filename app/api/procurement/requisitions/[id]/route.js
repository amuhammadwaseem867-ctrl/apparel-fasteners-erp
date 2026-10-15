import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { changeRequisition, getRequisition } from "@/server/procurement/procurement.service";
import { requisitionActionSchema } from "@/server/procurement/procurement.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "purchasing:view");
    const { id } = await params;
    return { data: await getRequisition(id) };
  });
}

/* PATCH { action, note }: submit/cancel need purchasing:create, approve/reject purchasing:approve. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const { action, note } = await parseRequestBody(request, requisitionActionSchema);
    const user = await authorizeRequest(request, ["approve", "reject"].includes(action) ? "purchasing:approve" : "purchasing:create");
    const { id } = await params;
    return { data: await changeRequisition(id, action, note ?? "", user.id) };
  });
}
