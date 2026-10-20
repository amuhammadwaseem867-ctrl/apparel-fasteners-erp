import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getOrderPackingList } from "@/server/packing/packing.service";

/* The order's packing list: every product's rows in one document (D-048). */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { id } = await params;
    return { data: await getOrderPackingList(id) };
  });
}
