import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { setRoleStatus, updateRole } from "@/server/admin/admin.service";
import { roleStatusSchema, roleUpdateSchema } from "@/server/admin/admin.validation";

/* PUT { name, description, permissions }: custom roles only (roles:update). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "roles:update");
    const input = await parseRequestBody(request, roleUpdateSchema);
    const { id } = await params;
    return { data: await updateRole(id, input, user.id) };
  });
}

export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "roles:update");
    const { status } = await parseRequestBody(request, roleStatusSchema);
    const { id } = await params;
    return { data: await setRoleStatus(id, status, user.id) };
  });
}
