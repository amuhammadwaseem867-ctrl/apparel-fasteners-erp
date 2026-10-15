import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createPayrollRun, listPayrollRuns } from "@/server/payroll/payroll.service";
import { payrollRunInputSchema } from "@/server/payroll/hr.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "payroll:view");
    return { data: { runs: await listPayrollRuns() } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "payroll:process");
    const { period, notes } = await parseRequestBody(request, payrollRunInputSchema);
    return { data: await createPayrollRun(period, notes ?? "", user.id), status: 201 };
  });
}
