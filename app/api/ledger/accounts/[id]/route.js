import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateAccount } from "@/server/ledger/ledger.service";
import { accountUpdateSchema } from "@/server/ledger/ledger.validation";

export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const input = await parseRequestBody(request, accountUpdateSchema);
    const { id } = await params;
    return { data: await updateAccount(id, input, user.id) };
  });
}
