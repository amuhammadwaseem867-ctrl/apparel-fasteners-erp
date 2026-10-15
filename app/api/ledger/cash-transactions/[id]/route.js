import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getCashTransaction, voidCashTransaction } from "@/server/ledger/ledger.service";
import { voidSchema } from "@/server/ledger/ledger.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getCashTransaction(id) };
  });
}

/* PATCH { reason } voids and reverses the posting (finance:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const { reason } = await parseRequestBody(request, voidSchema);
    const { id } = await params;
    return { data: await voidCashTransaction(id, reason, user.id) };
  });
}
