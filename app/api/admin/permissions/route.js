import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { listPermissions } from "@/server/admin/admin.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "roles:view");
    return { data: { permissions: await listPermissions() } };
  });
}
