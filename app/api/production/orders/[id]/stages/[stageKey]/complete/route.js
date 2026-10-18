import { AppError } from "@/server/core/errors/app-error";
import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { completeStage } from "@/server/production/production.service";
import { completionNoteSchema, stageKeySchema } from "@/server/production/production.validation";

export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:complete");
    const { id, stageKey } = await params;
    if (!stageKeySchema.safeParse(stageKey).success) {
      throw new AppError("Unknown production stage.", { code: "STAGE_NOT_FOUND", status: 404 });
    }
    // The body is optional: { note } left with the completed stage.
    const text = await request.text();
    let body = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new AppError("The request body is not valid JSON.", { code: "INVALID_JSON", status: 400 });
      }
    }
    const note = completionNoteSchema.safeParse(body?.note ?? undefined);
    if (!note.success) throw new AppError("The completion note is too long (1000 characters at most).", { code: "VALIDATION_FAILED", status: 400 });
    return { data: await completeStage(id, stageKey, user.id, note.data) };
  });
}
