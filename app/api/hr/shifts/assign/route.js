import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { assignShift } from "@/server/payroll/leave.service";
import { shiftAssignSchema } from "@/server/payroll/leave.validation";

/* POST { employeeIds, shiftId | null } assigns (or clears) a shift. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const { employeeIds, shiftId } = await parseRequestBody(request, shiftAssignSchema);
    return { data: await assignShift(employeeIds, shiftId, user.id) };
  });
}
