import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { cancelRfq, getRfq } from "@/server/procurement/procurement.service";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "purchasing:view");
    const { id } = await params;
    return { data: await getRfq(id) };
  });
}

/* DELETE cancels an open RFQ (it stays on record). */
export function DELETE(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "purchasing:create");
    const { id } = await params;
    return { data: await cancelRfq(id, user.id) };
  });
}
