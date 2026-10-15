import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listReceipts, recordReceipt } from "@/server/finance/finance.service";
import { receiptInputSchema, receiptQuerySchema } from "@/server/finance/finance.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: await listReceipts(parseQuery(request, receiptQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    const input = await parseRequestBody(request, receiptInputSchema);
    return { data: await recordReceipt(input, user.id), status: 201 };
  });
}
