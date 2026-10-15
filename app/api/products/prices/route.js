import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { changePrice, listPriceChanges } from "@/server/products/catalogue.service";
import { catalogueQuerySchema, priceChangeSchema } from "@/server/products/catalogue.validation";

/* Price history (newest first). */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "products:view");
    return { data: await listPriceChanges(parseQuery(request, catalogueQuerySchema)) };
  });
}

/* POST { productId, unitPrice, effectiveDate, reason } changes one price with history. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "products:update");
    const { productId, ...input } = await parseRequestBody(request, priceChangeSchema);
    return { data: await changePrice(productId, input, user.id), status: 201 };
  });
}
