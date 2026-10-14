import { AppError } from "@/server/core/errors/app-error";
import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { completeStage } from "@/server/production/production.service";
import { stageKeySchema } from "@/server/production/production.validation";

export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:complete");
    const { id, stageKey } = await params;
    if (!stageKeySchema.safeParse(stageKey).success) {
      throw new AppError("Unknown production stage.", { code: "STAGE_NOT_FOUND", status: 404 });
    }
    return { data: await completeStage(id, stageKey, user.id) };
  });
}
