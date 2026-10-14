import { requirePermission } from "@/server/auth/authorization.service";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeBomState, getBom, updateBom } from "@/server/planning/bom.service";
import { bomActionSchema, bomUpdateSchema } from "@/server/planning/planning.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { id } = await params;
    return { data: await getBom(id) };
  });
}

/* Edits a DRAFT revision. */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:create");
    const input = await parseRequestBody(request, bomUpdateSchema);
    const { id } = await params;
    return { data: await updateBom(id, input, user.id) };
  });
}

/*
 * PATCH { action }: "revise" copies into a new draft (production:create);
 * "approve", "activate" and "obsolete" need production:update.
 */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:view");
    const { action } = await parseRequestBody(request, bomActionSchema);
    await requirePermission(user.id, action === "revise" ? "production:create" : "production:update");
    const { id } = await params;
    const result = await changeBomState(id, action, user.id);
    return { data: result, status: action === "revise" ? 201 : 200 };
  });
}
