import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getWarehouse, setWarehouseStatus, updateWarehouse } from "@/server/inventory/inventory.service";
import { statusChangeSchema, warehouseUpdateSchema } from "@/server/inventory/inventory.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    const { id } = await params;
    return { data: await getWarehouse(id) };
  });
}

export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const input = await parseRequestBody(request, warehouseUpdateSchema);
    const { id } = await params;
    return { data: await updateWarehouse(id, input, user.id) };
  });
}

/* PATCH { status: ACTIVE | INACTIVE | ARCHIVED } */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const { status } = await parseRequestBody(request, statusChangeSchema);
    const { id } = await params;
    return { data: await setWarehouseStatus(id, status, user.id) };
  });
}
