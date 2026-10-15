import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createPurchaseOrder, listPurchaseOrders } from "@/server/procurement/procurement.service";
import { listQuerySchema, purchaseOrderInputSchema } from "@/server/procurement/procurement.validation";

/* Finance reads POs to match bills; stores read them to receive goods. */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["purchasing:view", "finance:view", "inventory:create"]);
    return { data: await listPurchaseOrders(parseQuery(request, listQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:create");
    return { data: await createPurchaseOrder(await parseRequestBody(request, purchaseOrderInputSchema), user.id), status: 201 };
  });
}
