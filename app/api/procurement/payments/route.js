import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listSupplierPayments, recordSupplierPayment } from "@/server/procurement/payables.service";
import { listQuerySchema, supplierPaymentInputSchema } from "@/server/procurement/procurement.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: await listSupplierPayments(parseQuery(request, listQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    return { data: await recordSupplierPayment(await parseRequestBody(request, supplierPaymentInputSchema), user.id), status: 201 };
  });
}
