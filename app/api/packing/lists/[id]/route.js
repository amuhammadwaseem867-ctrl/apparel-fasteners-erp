import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changePackingList, getPackingList } from "@/server/packing/packing.service";
import { packingActionSchema } from "@/server/packing/packing.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { id } = await params;
    return { data: await getPackingList(id) };
  });
}

/* PATCH { action: confirm | cancel } */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const { action } = await parseRequestBody(request, packingActionSchema);
    const { id } = await params;
    return { data: await changePackingList(id, action, user.id) };
  });
}
