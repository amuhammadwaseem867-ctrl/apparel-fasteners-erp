import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { cancelAdvance } from "@/server/payroll/payroll.service";

/* PATCH: cancels an open advance with nothing recovered yet. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "payroll:process");
    const { id } = await params;
    return { data: await cancelAdvance(id, user.id) };
  });
}
