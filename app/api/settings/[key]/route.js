import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { setSetting } from "@/server/settings/settings.service";

/* PUT the setting's value (administrators: roles:update). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "roles:update");
    const { key } = await params;
    let body;
    try {
      body = await request.json();
    } catch (cause) {
      throw new AppError("Request body must be valid JSON.", { code: "INVALID_JSON", status: 400, cause });
    }
    return { data: await setSetting(key, body, user.id) };
  });
}
