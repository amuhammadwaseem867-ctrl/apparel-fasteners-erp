import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getStockDocument } from "@/server/inventory/inventory.service";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    const { id } = await params;
    return { data: await getStockDocument(id) };
  });
}
