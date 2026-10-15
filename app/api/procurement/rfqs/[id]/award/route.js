import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { awardRfq } from "@/server/procurement/procurement.service";
import { awardSchema } from "@/server/procurement/procurement.validation";

/* Awards a quote and raises a draft PO at its prices. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:approve");
    const { quoteId, idempotencyKey } = await parseRequestBody(request, awardSchema);
    const { id } = await params;
    return { data: await awardRfq(id, quoteId, idempotencyKey, user.id), status: 201 };
  });
}
