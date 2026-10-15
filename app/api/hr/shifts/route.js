import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createShift, listRoster, listShifts } from "@/server/payroll/leave.service";
import { shiftInputSchema } from "@/server/payroll/leave.validation";

/* Shifts with paid minutes and head count, plus the roster of active employees. */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "hr:view");
    return { data: { shifts: await listShifts(), roster: await listRoster() } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    return { data: await createShift(await parseRequestBody(request, shiftInputSchema), user.id), status: 201 };
  });
}
