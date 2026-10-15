import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateDepartment } from "@/server/payroll/hr.service";
import { departmentUpdateSchema } from "@/server/payroll/hr.validation";

export function PUT(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "hr:manage");
    const input = await parseRequestBody(request, departmentUpdateSchema);
    const { id } = await params;
    return { data: await updateDepartment(id, input, user.id) };
  });
}
