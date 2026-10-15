import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getSupplierPayment, voidSupplierPayment } from "@/server/procurement/payables.service";
import { voidSchema } from "@/server/procurement/procurement.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getSupplierPayment(id) };
  });
}

/* PATCH { reason } voids a posted payment (finance:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const { reason } = await parseRequestBody(request, voidSchema);
    const { id } = await params;
    return { data: await voidSupplierPayment(id, reason, user.id) };
  });
}
