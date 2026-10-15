import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { updateCategory } from "@/server/products/catalogue.service";
import { categoryUpdateSchema } from "@/server/products/catalogue.validation";

/* PATCH renames (also on every product), describes or deactivates a category. */
export function PATCH(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "products:update");
    const input = await parseRequestBody(request, categoryUpdateSchema);
    const { id } = await params;
    return { data: await updateCategory(id, input, user.id) };
  });
}
