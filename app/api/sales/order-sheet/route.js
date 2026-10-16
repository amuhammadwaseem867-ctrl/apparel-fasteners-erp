import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createOrderFromSheet } from "@/server/sales/order-sheet.service";
import { orderSheetSchema } from "@/server/sales/sales.validation";

/* A new order from the order sheet; each line is tied to the item for its exact specification. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:create");
    return { data: await createOrderFromSheet(await parseRequestBody(request, orderSheetSchema), user.id), status: 201 };
  });
}
