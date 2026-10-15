import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createDepartment, listDepartments } from "@/server/payroll/hr.service";
import { departmentInputSchema } from "@/server/payroll/hr.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "hr:view");
    return { data: { departments: await listDepartments() } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const input = await parseRequestBody(request, departmentInputSchema);
    return { data: await createDepartment(input, user.id), status: 201 };
  });
}
