import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { setEmployeePay } from "@/server/payroll/hr.service";
import { employeePaySchema } from "@/server/payroll/hr.validation";

/* PUT { payBasis, basicSalary, allowances, overtimeRate, fixedDeduction } (payroll:process). */
export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "payroll:process");
    const input = await parseRequestBody(request, employeePaySchema);
    const { id } = await params;
    return { data: await setEmployeePay(id, input, user.id) };
  });
}
