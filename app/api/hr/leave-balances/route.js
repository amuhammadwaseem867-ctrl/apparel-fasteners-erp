import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { getLeaveBalances } from "@/server/payroll/leave.service";
import { leaveQuerySchema } from "@/server/payroll/leave.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "hr:view");
    const { year } = parseQuery(request, leaveQuerySchema);
    return { data: await getLeaveBalances(year ?? new Date().getUTCFullYear()) };
  });
}
