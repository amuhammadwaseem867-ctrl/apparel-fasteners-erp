import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { saveQuote } from "@/server/procurement/procurement.service";
import { quoteInputSchema } from "@/server/procurement/procurement.validation";

/* Records or replaces one supplier's quote while the RFQ is open. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:create");
    const input = await parseRequestBody(request, quoteInputSchema);
    const { id } = await params;
    return { data: await saveQuote(id, input, user.id), status: 201 };
  });
}
