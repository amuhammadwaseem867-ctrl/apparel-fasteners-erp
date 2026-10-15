import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createLeaveType, listLeaveTypes } from "@/server/payroll/leave.service";
import { leaveTypeInputSchema } from "@/server/payroll/leave.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "hr:view");
    return { data: { leaveTypes: await listLeaveTypes() } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    return { data: await createLeaveType(await parseRequestBody(request, leaveTypeInputSchema), user.id), status: 201 };
  });
}
