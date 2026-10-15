import { requirePermission } from "@/server/auth/authorization.service";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { changePayrollRun, getPayrollRun } from "@/server/payroll/payroll.service";
import { payrollActionSchema } from "@/server/payroll/hr.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "payroll:view");
    const { id } = await params;
    return { data: await getPayrollRun(id) };
  });
}

/* PATCH { action }: recalculate/cancel need payroll:process; approve/pay need payroll:approve. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "payroll:view");
    const { action, paymentReference } = await parseRequestBody(request, payrollActionSchema);
    await requirePermission(user.id, ["approve", "pay"].includes(action) ? "payroll:approve" : "payroll:process");
    const { id } = await params;
    return { data: await changePayrollRun(id, action, paymentReference ?? "", user.id) };
  });
}
