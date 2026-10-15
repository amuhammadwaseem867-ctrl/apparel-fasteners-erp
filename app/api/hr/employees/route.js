import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createEmployee, listEmployees } from "@/server/payroll/hr.service";
import { employeeInputSchema, employeeQuerySchema } from "@/server/payroll/hr.validation";

/* Pay fields are included only for users with payroll:view (D-027). */
export function GET(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:view");
    return { data: await listEmployees(parseQuery(request, employeeQuerySchema), user.permissions.includes("payroll:view")) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const input = await parseRequestBody(request, employeeInputSchema);
    return { data: await createEmployee(input, user.id), status: 201 };
  });
}
