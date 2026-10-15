import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { listAuditActions } from "@/server/admin/admin.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "audit:view");
    return { data: { actions: await listAuditActions() } };
  });
}
