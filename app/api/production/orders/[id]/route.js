import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeProductionStatus, getProductionOrder } from "@/server/production/production.service";
import { productionActionSchema } from "@/server/production/production.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { id } = await params;
    return { data: await getProductionOrder(id) };
  });
}

/* PATCH { action: release | hold | resume | cancel, reason? } */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const { action, reason } = await parseRequestBody(request, productionActionSchema);
    const { id } = await params;
    return { data: await changeProductionStatus(id, action, reason ?? "", user.id) };
  });
}
