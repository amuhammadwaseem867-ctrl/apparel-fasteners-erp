import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getQualitySummary } from "@/server/quality/quality.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "quality:view");
    return { data: await getQualitySummary() };
  });
}
