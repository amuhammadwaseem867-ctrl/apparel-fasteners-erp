import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createGatePass, listGatePasses } from "@/server/gate/gate-pass.service";
import { gatePassInputSchema, gatePassQuerySchema } from "@/server/gate/gate-pass.validation";

/* Gate passes use the inventory permissions (D-026). */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await listGatePasses(parseQuery(request, gatePassQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const input = await parseRequestBody(request, gatePassInputSchema);
    return { data: await createGatePass(input, user.id), status: 201 };
  });
}
