import { authorizeRequest } from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { runRoute } from "@/server/core/api/route";
import { getMrpRun, latestMrpRunId } from "@/server/planning/mrp.service";

/* GET /api/planning/mrp-runs/latest returns the most recent run. */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { id } = await params;
    const runId = id === "latest" ? await latestMrpRunId() : id;
    if (!runId) {
      throw new AppError("No MRP run has been made yet.", { code: "MRP_RUN_NOT_FOUND", status: 404 });
    }
    return { data: await getMrpRun(runId) };
  });
}
