import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { listWorkCenters } from "@/server/planning/scheduling.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    return { data: { workCenters: await listWorkCenters() } };
  });
}
