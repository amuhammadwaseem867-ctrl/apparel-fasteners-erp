import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateOrderFromSheet } from "@/server/sales/order-sheet.service";
import { orderSheetSchema } from "@/server/sales/sales.validation";

/* Edit a draft order from the order sheet. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:update");
    const { id } = await params;
    return { data: await updateOrderFromSheet(id, await parseRequestBody(request, orderSheetSchema), user.id) };
  });
}
