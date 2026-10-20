import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listInvoices } from "@/server/finance/finance.service";
import { invoiceQuerySchema } from "@/server/finance/finance.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: await listInvoices(parseQuery(request, invoiceQuerySchema)) };
  });
}

/* Invoices are made first, by hand: POST /api/finance/invoices/manual (D-048). */
