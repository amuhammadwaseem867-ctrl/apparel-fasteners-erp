import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { addStandardRawMaterials } from "@/server/inventory/raw-material.service";

/* Adds AF7's raw material list to the item master; safe to run again. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "products:create");
    return { data: await addStandardRawMaterials(user.id) };
  });
}
