import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateShift } from "@/server/payroll/leave.service";
import { shiftUpdateSchema } from "@/server/payroll/leave.validation";

export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const input = await parseRequestBody(request, shiftUpdateSchema);
    const { id } = await params;
    return { data: await updateShift(id, input, user.id) };
  });
}
