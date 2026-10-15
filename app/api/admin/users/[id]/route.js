import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getUserDetail, setUserStatus, updateUserAccount } from "@/server/admin/admin.service";
import { userStatusSchema, userUpdateSchema } from "@/server/admin/admin.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "users:view");
    const { id } = await params;
    return { data: await getUserDetail(id) };
  });
}

/* PUT { name, phone, roles }: profile and role assignment (users:update). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "users:update");
    const input = await parseRequestBody(request, userUpdateSchema);
    const { id } = await params;
    return { data: await updateUserAccount(id, input, user.id) };
  });
}

/* PATCH { status }: enable or disable an account (users:disable). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "users:disable");
    const { status } = await parseRequestBody(request, userStatusSchema);
    const { id } = await params;
    return { data: await setUserStatus(id, status, user.id) };
  });
}
