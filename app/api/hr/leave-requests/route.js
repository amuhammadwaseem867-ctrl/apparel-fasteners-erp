import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createLeaveRequest, listLeaveRequests } from "@/server/payroll/leave.service";
import { leaveQuerySchema, leaveRequestInputSchema } from "@/server/payroll/leave.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "hr:view");
    return { data: await listLeaveRequests(parseQuery(request, leaveQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    return { data: await createLeaveRequest(await parseRequestBody(request, leaveRequestInputSchema), user.id), status: 201 };
  });
}
