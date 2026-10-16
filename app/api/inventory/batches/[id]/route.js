import { authorizeAnyRequest, authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getBatch, setBatchStatus } from "@/server/inventory/batches.service";
import { batchStatusSchema } from "@/server/planning/scheduling.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["inventory:view", "quality:view"]);
    const { id } = await params;
    return { data: await getBatch(id) };
  });
}

/* PATCH { status, note }: hold, release or reject (quality:approve); consume (inventory:create or quality:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const { status, note } = await parseRequestBody(request, batchStatusSchema);
    const user = status === "CONSUMED" ? await authorizeAnyRequest(request, ["inventory:create", "quality:approve"]) : await authorizeRequest(request, "quality:approve");
    const { id } = await params;
    return { data: await setBatchStatus(id, status, note ?? "", user.id) };
  });
}
