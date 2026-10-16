import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getOrderTrace } from "@/server/sales/order-trace.service";

/* Order Profile: the order and everything that happened to it. */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    const { id } = await params;
    return { data: await getOrderTrace(id) };
  });
}
