import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { getQuickCosting } from "@/server/costing/costing.service";

/* Quick costing (D-059): calculates only. No order, invoice or accounting entry is made. */
export function POST(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    let body;
    try {
      body = await request.json();
    } catch (cause) {
      throw new AppError("Request body must be valid JSON.", { code: "INVALID_JSON", status: 400, cause });
    }
    return { data: await getQuickCosting(body) };
  });
}
