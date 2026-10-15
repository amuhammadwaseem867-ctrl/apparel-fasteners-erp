import { requirePermission } from "@/server/auth/authorization.service";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeGatePass, getGatePass } from "@/server/gate/gate-pass.service";
import { gatePassActionSchema } from "@/server/gate/gate-pass.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    const { id } = await params;
    return { data: await getGatePass(id) };
  });
}

/* PATCH { action }: approve and cancel need inventory:adjust; recording the gate movement needs inventory:create. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:view");
    const { action, guardName, reason } = await parseRequestBody(request, gatePassActionSchema);
    await requirePermission(user.id, action === "pass" ? "inventory:create" : "inventory:adjust");
    const { id } = await params;
    return { data: await changeGatePass(id, action, { guardName, reason }, user.id) };
  });
}
