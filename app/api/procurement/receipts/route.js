import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listPurchaseReceipts, receivePurchaseOrder } from "@/server/procurement/procurement.service";
import { listQuerySchema, receiptInputSchema } from "@/server/procurement/procurement.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["purchasing:view", "inventory:view"]);
    return { data: await listPurchaseReceipts(parseQuery(request, listQuerySchema)) };
  });
}

/* Goods receipt against a PO: purchasing or stores staff. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeAnyRequest(request, ["purchasing:create", "inventory:create"]);
    return { data: await receivePurchaseOrder(await parseRequestBody(request, receiptInputSchema), user.id), status: 201 };
  });
}
