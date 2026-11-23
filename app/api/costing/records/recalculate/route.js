import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { recalculateInvoiceCostings } from "@/server/costing/costing.service";

/* Recalculates saved invoice costings with the current rates (D-061), one batch per call. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:update");
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    return { data: await recalculateInvoiceCostings(body, user.id) };
  });
}
