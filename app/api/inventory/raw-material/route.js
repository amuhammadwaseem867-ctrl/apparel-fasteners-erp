import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { rawMaterialQuerySchema } from "@/server/inventory/inventory.validation";
import { getRawMaterialStock } from "@/server/inventory/raw-material.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await getRawMaterialStock(parseQuery(request, rawMaterialQuerySchema)) };
  });
}
