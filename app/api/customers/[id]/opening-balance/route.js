import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { setOpeningBalance } from "@/server/finance/customer-account.service";
import { openingBalanceSchema } from "@/server/finance/finance.validation";

/* PUT { amount, date, notes }: what the customer owed before the ERP (D-052). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    const { id } = await params;
    return { data: await setOpeningBalance(id, await parseRequestBody(request, openingBalanceSchema), user.id) };
  });
}
