import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getSupplierPerformance } from "@/server/procurement/procurement.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "purchasing:view");
    return { data: { suppliers: await getSupplierPerformance() } };
  });
}
