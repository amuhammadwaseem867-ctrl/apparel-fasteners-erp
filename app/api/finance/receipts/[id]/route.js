import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getReceipt, voidReceipt } from "@/server/finance/finance.service";
import { voidReceiptSchema } from "@/server/finance/finance.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getReceipt(id) };
  });
}

/* PATCH { reason }: voids a posted receipt (finance:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const { reason } = await parseRequestBody(request, voidReceiptSchema);
    const { id } = await params;
    return { data: await voidReceipt(id, reason, user.id) };
  });
}
