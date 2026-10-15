import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { changePurchaseOrder, getPurchaseOrder } from "@/server/procurement/procurement.service";
import { purchaseOrderActionSchema } from "@/server/procurement/procurement.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["purchasing:view", "finance:view", "inventory:create"]);
    const { id } = await params;
    return { data: await getPurchaseOrder(id) };
  });
}

/* PATCH { action: approve | cancel | close, reason } (purchasing:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:approve");
    const { action, reason } = await parseRequestBody(request, purchaseOrderActionSchema);
    const { id } = await params;
    return { data: await changePurchaseOrder(id, action, reason ?? "", user.id) };
  });
}
