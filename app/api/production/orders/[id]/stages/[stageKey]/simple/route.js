import { z } from "zod";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { finishStage, startStage } from "@/server/production/production.service";
import { stageKeySchema } from "@/server/production/production.validation";

const actionSchema = z.object({
  action: z.enum(["start", "complete"]),
  // Tape Dyeing only: the total tape weight in kg.
  totalQuantity: z.number().finite().positive().max(1000000).optional(),
  // A note left with the completed stage.
  note: z.string().trim().max(1000).optional(),
});

/* The simple production board: start a stage, or complete it in one step. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const { id, stageKey } = await params;
    if (!stageKeySchema.safeParse(stageKey).success) {
      throw new AppError("Unknown production stage.", { code: "STAGE_NOT_FOUND", status: 404 });
    }
    const input = await parseRequestBody(request, actionSchema);
    // Completing records the stage's output too, so it needs both rights.
    const user = await authorizeRequest(request, "production:update");
    if (input.action === "complete" && !user.permissions.includes("production:complete")) {
      throw new AppError("Forbidden.", { code: "FORBIDDEN", status: 403, details: { requiredPermission: "production:complete" } });
    }
    const data = input.action === "start"
      ? await startStage(id, stageKey, user.id)
      : await finishStage(id, stageKey, { totalQuantity: input.totalQuantity, note: input.note }, user.id);
    return { data };
  });
}
