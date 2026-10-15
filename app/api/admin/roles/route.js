import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createRole, listRoles } from "@/server/admin/admin.service";
import { roleInputSchema } from "@/server/admin/admin.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "roles:view");
    return { data: { roles: await listRoles() } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "roles:create");
    const input = await parseRequestBody(request, roleInputSchema);
    return { data: await createRole(input, user.id), status: 201 };
  });
}
