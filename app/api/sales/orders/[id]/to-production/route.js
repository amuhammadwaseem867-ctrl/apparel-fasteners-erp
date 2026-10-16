import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { sendOrderToProduction } from "@/server/sales/order-trace.service";

/* Opens and releases one production order per order line not yet in production. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:create");
    const { id } = await params;
    return { data: await sendOrderToProduction(id, user.id), status: 201 };
  });
}
