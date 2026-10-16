import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateInstruction } from "@/server/packing/instructions.service";
import { instructionUpdateSchema } from "@/server/planning/scheduling.validation";

export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const input = await parseRequestBody(request, instructionUpdateSchema);
    const { id } = await params;
    return { data: await updateInstruction(id, input, user.id) };
  });
}
