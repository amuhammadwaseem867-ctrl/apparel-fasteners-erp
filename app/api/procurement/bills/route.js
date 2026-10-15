import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createBill, listBills } from "@/server/procurement/payables.service";
import { billInputSchema, listQuerySchema } from "@/server/procurement/procurement.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["finance:view", "purchasing:view"]);
    return { data: await listBills(parseQuery(request, listQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    return { data: await createBill(await parseRequestBody(request, billInputSchema), user.id), status: 201 };
  });
}
