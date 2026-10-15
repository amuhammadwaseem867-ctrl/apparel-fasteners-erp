import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateLeaveType } from "@/server/payroll/leave.service";
import { leaveTypeUpdateSchema } from "@/server/payroll/leave.validation";

export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const input = await parseRequestBody(request, leaveTypeUpdateSchema);
    const { id } = await params;
    return { data: await updateLeaveType(id, input, user.id) };
  });
}
