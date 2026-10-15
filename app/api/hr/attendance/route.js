import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listAttendance, saveAttendance } from "@/server/payroll/hr.service";
import { attendanceQuerySchema, attendanceSaveSchema } from "@/server/payroll/hr.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "hr:view");
    return { data: await listAttendance(parseQuery(request, attendanceQuerySchema)) };
  });
}

/* POST { date, records }: upserts one day's attendance; refused once that month's payroll is approved. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const input = await parseRequestBody(request, attendanceSaveSchema);
    return { data: await saveAttendance(input, user.id) };
  });
}
