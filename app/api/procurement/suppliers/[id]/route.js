import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { getSupplier, updateSupplier } from "@/server/procurement/procurement.service";
import { supplierUpdateSchema } from "@/server/procurement/procurement.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["purchasing:view", "finance:view"]);
    const { id } = await params;
    return { data: await getSupplier(id) };
  });
}

export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:create");
    const input = await parseRequestBody(request, supplierUpdateSchema);
    const { id } = await params;
    return { data: await updateSupplier(id, input, user.id) };
  });
}
