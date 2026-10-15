import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getEmployee, updateEmployee } from "@/server/payroll/hr.service";
import { employeeUpdateSchema } from "@/server/payroll/hr.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:view");
    const { id } = await params;
    return { data: await getEmployee(id, user.permissions.includes("payroll:view")) };
  });
}

export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const input = await parseRequestBody(request, employeeUpdateSchema);
    const { id } = await params;
    return { data: await updateEmployee(id, input, user.id) };
  });
}
