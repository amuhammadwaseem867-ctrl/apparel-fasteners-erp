import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createUserAccount, listUsers } from "@/server/admin/admin.service";
import { userCreateSchema, userQuerySchema } from "@/server/admin/admin.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "users:view");
    return { data: await listUsers(parseQuery(request, userQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "users:create");
    const input = await parseRequestBody(request, userCreateSchema);
    return { data: await createUserAccount(input, user.id), status: 201 };
  });
}
