import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getReservation, releaseReservation } from "@/server/inventory/inventory.service";
import { reservationReleaseSchema } from "@/server/inventory/inventory.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    const { id } = await params;
    return { data: await getReservation(id) };
  });
}

/* POST releases open quantity: { idempotencyKey, quantity? } */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const input = await parseRequestBody(request, reservationReleaseSchema);
    const { id } = await params;
    return { data: await releaseReservation(id, input, user.id) };
  });
}
