import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { saveWorkCenter } from "@/server/planning/scheduling.service";
import { workCenterSchema } from "@/server/planning/scheduling.validation";

/* PUT sets the capacity of one stage's work centre. */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const input = await parseRequestBody(request, workCenterSchema);
    const { stageKey } = await params;
    return { data: await saveWorkCenter(stageKey, input, user.id) };
  });
}
