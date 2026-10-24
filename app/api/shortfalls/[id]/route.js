import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { cancelShortfall, getShortfall, resolveShortfall } from "@/server/sales/shortfall.service";
import { shortfallActionSchema } from "@/server/sales/shortfall.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    const { id } = await params;
    return { data: await getShortfall(id) };
  });
}

/* PATCH { quantity? } resolves; PATCH { action: "cancel" } cancels. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:update");
    const body = await parseRequestBody(request, shortfallActionSchema);
    const { id } = await params;
    if (body.action === "cancel") {
      return { data: await cancelShortfall(id, user.id) };
    }
    return { data: await resolveShortfall(id, body, user.id) };
  });
}
