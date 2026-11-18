import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { deleteCostingRecord, getCostingRecord } from "@/server/costing/costing.service";

/* One saved costing (D-060), with the costing as it was calculated. */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    const { id } = await params;
    return { data: await getCostingRecord(id) };
  });
}

export function DELETE(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:update");
    const { id } = await params;
    return { data: await deleteCostingRecord(id, user.id) };
  });
}
