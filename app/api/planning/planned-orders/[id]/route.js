import { z } from "zod";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { setPlannedOrderStatus } from "@/server/planning/mrp.service";

const statusSchema = z.object({ status: z.enum(["CONFIRMED", "CANCELLED"]) });

/* PATCH { status }: confirms or cancels a SUGGESTED planned order, once. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:update");
    const { status } = await parseRequestBody(request, statusSchema);
    const { id } = await params;
    return { data: await setPlannedOrderStatus(id, status, user.id) };
  });
}
