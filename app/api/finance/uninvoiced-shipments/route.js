import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { listUninvoicedShipments } from "@/server/finance/finance.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: { shipments: await listUninvoicedShipments() } };
  });
}
