import { getCurrentUser } from "@/server/auth/auth.service";
import { extractSessionTokenFromRequest } from "@/server/auth/session.service";
import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { getSetting, listSettings } from "@/server/settings/settings.service";

/* Any signed-in user reads the company profile (every print needs it); ?all=1 needs roles:view. */
export function GET(request) {
  return runRoute(request, async () => {
    if (new URL(request.url).searchParams.get("all") === "1") {
      await authorizeRequest(request, "roles:view");
      return { data: await listSettings() };
    }
    if (!(await getCurrentUser(extractSessionTokenFromRequest(request)))) throw new AppError("Authentication is required.", { code: "AUTH_REQUIRED", status: 401 });
    return { data: { company: await getSetting("company.profile") } };
  });
}
