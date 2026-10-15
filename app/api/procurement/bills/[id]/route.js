import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { changeBill, getBill } from "@/server/procurement/payables.service";
import { billActionSchema } from "@/server/procurement/procurement.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["finance:view", "purchasing:view"]);
    const { id } = await params;
    return { data: await getBill(id) };
  });
}

/* PATCH { action: approve | cancel, reason } (finance:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const { action, reason } = await parseRequestBody(request, billActionSchema);
    const { id } = await params;
    return { data: await changeBill(id, action, reason ?? "", user.id) };
  });
}
