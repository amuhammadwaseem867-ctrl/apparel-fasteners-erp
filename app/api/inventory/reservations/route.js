import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createReservation, listReservations } from "@/server/inventory/inventory.service";
import { reservationInputSchema, reservationQuerySchema } from "@/server/inventory/inventory.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await listReservations(parseQuery(request, reservationQuerySchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:create");
    const input = await parseRequestBody(request, reservationInputSchema);
    const result = await createReservation(input, user.id);
    return { data: result, status: result.replayed ? 200 : 201 };
  });
}
