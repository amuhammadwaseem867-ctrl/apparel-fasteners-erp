import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { setLocationStatus, updateLocation } from "@/server/inventory/inventory.service";
import { locationUpdateSchema, statusChangeSchema } from "@/server/inventory/inventory.validation";

export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const { name } = await parseRequestBody(request, locationUpdateSchema);
    const { id } = await params;
    return { data: await updateLocation(id, name, user.id) };
  });
}

/* PATCH { status: ACTIVE | INACTIVE | ARCHIVED } */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const { status } = await parseRequestBody(request, statusChangeSchema);
    const { id } = await params;
    return { data: await setLocationStatus(id, status, user.id) };
  });
}
