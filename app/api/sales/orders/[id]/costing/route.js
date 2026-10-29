import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getOrderCosting } from "@/server/costing/costing.service";

/* The order's consumption and cost report (D-055). Open to sales:view while it is being tried out. */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    const { id } = await params;
    return { data: await getOrderCosting(id) };
  });
}
