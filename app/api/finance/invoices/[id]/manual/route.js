import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateManualInvoice } from "@/server/finance/finance.service";
import { manualInvoiceSchema } from "@/server/finance/finance.validation";

/* Edits a draft invoice made first, with its order sheet (D-048). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    const { id } = await params;
    return { data: await updateManualInvoice(id, await parseRequestBody(request, manualInvoiceSchema), user.id) };
  });
}
