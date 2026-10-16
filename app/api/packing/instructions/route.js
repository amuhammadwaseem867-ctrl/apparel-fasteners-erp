import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createInstruction, listInstructions, resolveInstruction } from "@/server/packing/instructions.service";
import { instructionInputSchema, listSchema } from "@/server/planning/scheduling.validation";

/* GET lists instructions, or ?productId=&customerId= resolves the one that applies. */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const params = new URL(request.url).searchParams;
    if (params.get("productId")) return { data: { instruction: await resolveInstruction(params.get("productId"), params.get("customerId") ?? undefined) } };
    return { data: { instructions: await listInstructions(parseQuery(request, listSchema)) } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    return { data: await createInstruction(await parseRequestBody(request, instructionInputSchema), user.id), status: 201 };
  });
}
