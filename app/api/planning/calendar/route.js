import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { clearCalendarDay, getCalendarMonth, setCalendarDay } from "@/server/planning/scheduling.service";
import { calendarDaySchema, calendarQuerySchema } from "@/server/planning/scheduling.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { month } = parseQuery(request, calendarQuerySchema);
    return { data: await getCalendarMonth(month ?? new Date().toISOString().slice(0, 7)) };
  });
}

/* PUT { date, dayType, note } marks a holiday, shutdown or extra working day. */
export function PUT(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    return { data: await setCalendarDay(await parseRequestBody(request, calendarDaySchema), user.id) };
  });
}

/* DELETE ?date= removes that day's override. */
export function DELETE(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const { date } = parseQuery(request, calendarQuerySchema);
    if (!date) throw new AppError("Give the date.", { code: "VALIDATION_FAILED", status: 400 });
    return { data: await clearCalendarDay(date, user.id) };
  });
}
