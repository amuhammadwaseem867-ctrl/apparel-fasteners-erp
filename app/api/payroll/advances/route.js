import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createAdvance, listAdvances } from "@/server/payroll/payroll.service";
import { advanceInputSchema } from "@/server/payroll/hr.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "payroll:view");
    const url = new URL(request.url);
    return { data: { advances: await listAdvances({ status: url.searchParams.get("status") ?? "", employeeId: url.searchParams.get("employeeId") ?? "" }) } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "payroll:process");
    const input = await parseRequestBody(request, advanceInputSchema);
    return { data: await createAdvance(input, user.id), status: 201 };
  });
}
