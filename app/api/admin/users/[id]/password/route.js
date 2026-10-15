import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { resetUserPassword } from "@/server/admin/admin.service";
import { passwordResetSchema } from "@/server/admin/admin.validation";

/* POST { password }: sets a new password and ends the user's sessions. */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "users:update");
    const { password } = await parseRequestBody(request, passwordResetSchema);
    const { id } = await params;
    return { data: await resetUserPassword(id, password, user.id) };
  });
}
