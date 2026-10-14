import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getStockSummary } from "@/server/inventory/inventory.service";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    const includeItems = new URL(request.url).searchParams.get("include") === "items";
    return { data: await getStockSummary({ includeItems }) };
  });
}
