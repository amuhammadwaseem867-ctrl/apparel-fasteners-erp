import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { getCurrentUser } from "@/server/auth/auth.service";
import { extractSessionTokenFromRequest } from "@/server/auth/session.service";
import { attentionFor } from "@/server/dashboard/attention.service";

/* Work waiting on someone, for the top bar's bell; counts only the areas the user may see. */
export function GET(request) {
  return runRoute(request, async () => {
    const user = await getCurrentUser(extractSessionTokenFromRequest(request));
    if (!user) throw new AppError("Authentication is required.", { code: "AUTH_REQUIRED", status: 401 });
    return { data: await attentionFor(user.permissions) };
  });
}
