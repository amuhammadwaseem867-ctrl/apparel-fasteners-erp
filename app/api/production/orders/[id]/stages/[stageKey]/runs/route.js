import { AppError } from "@/server/core/errors/app-error";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { recordStageRun } from "@/server/production/production.service";
import { stageKeySchema, stageRunInputSchema } from "@/server/production/production.validation";

/* Records one run of output at a stage. Replays with the same idempotencyKey return 200. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const input = await parseRequestBody(request, stageRunInputSchema);
    const { id, stageKey } = await params;
    if (!stageKeySchema.safeParse(stageKey).success) {
      throw new AppError("Unknown production stage.", { code: "STAGE_NOT_FOUND", status: 404 });
    }
    const result = await recordStageRun(id, stageKey, input, user.id);
    return { data: result.order, status: result.replayed ? 200 : 201 };
  });
}
