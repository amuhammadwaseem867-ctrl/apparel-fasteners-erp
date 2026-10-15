import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changeLeaveRequest } from "@/server/payroll/leave.service";
import { leaveActionSchema } from "@/server/payroll/leave.validation";

/* PATCH { action: approve | reject | cancel, note } (hr:manage). */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const { action, note } = await parseRequestBody(request, leaveActionSchema);
    const { id } = await params;
    return { data: await changeLeaveRequest(id, action, note ?? "", user.id) };
  });
}
