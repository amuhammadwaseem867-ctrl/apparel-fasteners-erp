import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { bestStockLocation, createReservation, listReservations } from "@/server/inventory/inventory.service";
import { parseBodyWithTypedLocation } from "@/server/inventory/typed-location";
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
    // No location chosen (D-053): where the item's stock is.
    const input = await parseBodyWithTypedLocation(request, reservationInputSchema, user.id, async (body) => (
      typeof body.productId === "string" ? bestStockLocation(body.productId, user.id) : null
    ));
    const result = await createReservation(input, user.id);
    return { data: result, status: result.replayed ? 200 : 201 };
  });
}
