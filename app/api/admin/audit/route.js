import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listAuditLogs } from "@/server/admin/admin.service";
import { auditQuerySchema } from "@/server/admin/admin.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "audit:view");
    return { data: await listAuditLogs(parseQuery(request, auditQuerySchema)) };
  });
}
