import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createSupplier, listSuppliers } from "@/server/procurement/procurement.service";
import { listQuerySchema, supplierInputSchema } from "@/server/procurement/procurement.validation";

/* Suppliers are visible to purchasing and to finance (who pay them). */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["purchasing:view", "finance:view"]);
    return { data: await listSuppliers(parseQuery(request, listQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:create");
    return { data: await createSupplier(await parseRequestBody(request, supplierInputSchema), user.id), status: 201 };
  });
}
