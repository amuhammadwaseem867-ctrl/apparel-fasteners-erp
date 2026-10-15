import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createInvoice, listInvoices } from "@/server/finance/finance.service";
import { invoiceInputSchema, invoiceQuerySchema } from "@/server/finance/finance.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: await listInvoices(parseQuery(request, invoiceQuerySchema)) };
  });
}

/* Creates a DRAFT invoice for a dispatched shipment. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    const input = await parseRequestBody(request, invoiceInputSchema);
    return { data: await createInvoice(input, user.id), status: 201 };
  });
}
