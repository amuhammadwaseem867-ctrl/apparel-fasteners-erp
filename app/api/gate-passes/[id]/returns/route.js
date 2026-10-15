import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { recordGatePassReturn } from "@/server/gate/gate-pass.service";
import { gatePassReturnSchema } from "@/server/gate/gate-pass.validation";

/* POST { lines: [{ lineId, quantity }] }: goods back on a returnable pass. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const { lines } = await parseRequestBody(request, gatePassReturnSchema);
    const { id } = await params;
    return { data: await recordGatePassReturn(id, lines, user.id) };
  });
}
