import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeInvoice, getInvoice } from "@/server/finance/finance.service";
import { invoiceActionSchema } from "@/server/finance/finance.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getInvoice(id) };
  });
}

/* PATCH { action: issue | cancel, reason } (finance:approve). Only drafts change. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const { action, reason } = await parseRequestBody(request, invoiceActionSchema);
    const { id } = await params;
    return { data: await changeInvoice(id, action, reason ?? "", user.id) };
  });
}
