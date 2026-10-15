import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeNcr, getNcr, updateNcr } from "@/server/quality/ncr.service";
import { ncrActionSchema, ncrUpdateSchema } from "@/server/quality/ncr.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "quality:view");
    const { id } = await params;
    return { data: await getNcr(id) };
  });
}

/* PUT { containment, rootCause, disposition } while the NCR is open (quality:create). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "quality:create");
    const input = await parseRequestBody(request, ncrUpdateSchema);
    const { id } = await params;
    return { data: await updateNcr(id, input, user.id) };
  });
}

/* PATCH { action, note }: investigate (quality:create); close or cancel (quality:approve). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const { action, note } = await parseRequestBody(request, ncrActionSchema);
    const user = await authorizeRequest(request, action === "investigate" ? "quality:create" : "quality:approve");
    const { id } = await params;
    return { data: await changeNcr(id, action, note ?? "", user.id) };
  });
}
