import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listVariantFamilies } from "@/server/products/catalogue.service";
import { catalogueQuerySchema } from "@/server/products/catalogue.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "products:view");
    const { search } = parseQuery(request, catalogueQuerySchema);
    return { data: { families: await listVariantFamilies(search) } };
  });
}
