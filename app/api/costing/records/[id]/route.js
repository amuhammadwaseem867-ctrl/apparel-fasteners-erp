import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { deleteCostingRecord, getCostingRecord, updateCostingRecord } from "@/server/costing/costing.service";

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

export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:update");
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch (cause) {
      throw new AppError("Request body must be valid JSON.", { code: "INVALID_JSON", status: 400, cause });
    }
    return { data: await updateCostingRecord(id, body, user.id) };
  });
}
