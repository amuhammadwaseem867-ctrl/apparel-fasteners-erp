import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { recordStageChecks } from "@/server/production/stage-checks.service";
import { stageChecksInputSchema, stageKeySchema } from "@/server/production/production.validation";

/* Records a stage's check points (D-040): Pass, Fail or Not applicable. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const { id, stageKey } = await params;
    if (!stageKeySchema.safeParse(stageKey).success) {
      throw new AppError("Unknown production stage.", { code: "STAGE_NOT_FOUND", status: 404 });
    }
    const input = await parseRequestBody(request, stageChecksInputSchema);
    return { data: await recordStageChecks(id, stageKey, input, user.id) };
  });
}
