import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { stockCardQuerySchema } from "@/server/inventory/inventory.validation";
import { getItemStockCard } from "@/server/inventory/raw-material.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    const { id } = await params;
    if (!UUID.test(id)) throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 404 });
    return { data: await getItemStockCard(id, parseQuery(request, stockCardQuerySchema)) };
  });
}
