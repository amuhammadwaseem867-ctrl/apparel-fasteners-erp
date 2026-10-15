import { requirePermission } from "@/server/auth/authorization.service";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeShipment, getShipment } from "@/server/dispatch/dispatch.service";
import { shipmentActionSchema } from "@/server/dispatch/dispatch.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "dispatch:view");
    const { id } = await params;
    return { data: await getShipment(id) };
  });
}

/* PATCH { action }: dispatch needs dispatch:ship; deliver and cancel need dispatch:update. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "dispatch:view");
    const { action, receivedBy, deliveryNote } = await parseRequestBody(request, shipmentActionSchema);
    await requirePermission(user.id, action === "dispatch" ? "dispatch:ship" : "dispatch:update");
    const { id } = await params;
    return { data: await changeShipment(id, action, { receivedBy, deliveryNote }, user.id) };
  });
}
