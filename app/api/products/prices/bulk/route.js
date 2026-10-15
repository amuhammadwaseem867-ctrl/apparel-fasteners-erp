import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { bulkAdjustPrices } from "@/server/products/catalogue.service";
import { bulkPriceSchema } from "@/server/products/catalogue.validation";

/* POST { category, percent, effectiveDate, reason, apply }: preview (apply false) or apply. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "products:update");
    return { data: await bulkAdjustPrices(await parseRequestBody(request, bulkPriceSchema), user.id) };
  });
}
