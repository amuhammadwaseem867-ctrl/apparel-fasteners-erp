import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { getCapacityLoad } from "@/server/planning/scheduling.service";
import { calendarQuerySchema } from "@/server/planning/scheduling.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { horizon } = parseQuery(request, calendarQuerySchema);
    return { data: await getCapacityLoad(horizon) };
  });
}
