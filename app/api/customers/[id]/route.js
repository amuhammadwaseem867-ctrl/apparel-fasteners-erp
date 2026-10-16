import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateCustomer } from "@/server/sales/sales.service";
import { customerUpdateSchema } from "@/server/sales/sales.validation";

/* Edit a customer's name, contact and tax details (the code stays). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "customers:update");
    const { id } = await params;
    return { data: await updateCustomer(id, await parseRequestBody(request, customerUpdateSchema), user.id) };
  });
}
