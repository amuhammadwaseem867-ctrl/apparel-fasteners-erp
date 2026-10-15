import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { adjustPayrollLine } from "@/server/payroll/payroll.service";
import { payrollAdjustmentSchema } from "@/server/payroll/hr.validation";

/* PUT { otherEarning, otherDeduction, adjustmentNote }: draft runs only. */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "payroll:process");
    const input = await parseRequestBody(request, payrollAdjustmentSchema);
    const { id, lineId } = await params;
    return { data: await adjustPayrollLine(id, lineId, input, user.id) };
  });
}
