import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getSalesOrderFulfilment } from "@/server/dispatch/dispatch.service";

/* Ordered / shipped / delivered / remaining per item, and packed lists ready to ship. */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "dispatch:view");
    const { id } = await params;
    return { data: await getSalesOrderFulfilment(id) };
  });
}
