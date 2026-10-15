import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createCategory, listCategories } from "@/server/products/catalogue.service";
import { categoryInputSchema } from "@/server/products/catalogue.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "products:view");
    return { data: { categories: await listCategories() } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "products:update");
    return { data: await createCategory(await parseRequestBody(request, categoryInputSchema), user.id), status: 201 };
  });
}
