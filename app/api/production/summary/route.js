import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getProductionSummary } from "@/server/production/production.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: await getProductionSummary(new Date().toISOString().slice(0, 10)) };
  });
}
