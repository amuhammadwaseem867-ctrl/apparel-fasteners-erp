import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createManualInvoice } from "@/server/finance/finance.service";
import { manualInvoiceSchema } from "@/server/finance/finance.validation";

/* The invoice made first (D-048): creates the draft order and its invoice under one AF7 number. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    return { data: await createManualInvoice(await parseRequestBody(request, manualInvoiceSchema), user.id), status: 201 };
  });
}
