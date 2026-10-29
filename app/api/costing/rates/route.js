import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { getCostingRates, setCostingRates } from "@/server/costing/costing.service";

/* Costing rates (D-055): read with sales:view, change with sales:update while being tried out. */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    return { data: await getCostingRates() };
  });
}

export function PUT(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:update");
    let body;
    try {
      body = await request.json();
    } catch (cause) {
      throw new AppError("Request body must be valid JSON.", { code: "INVALID_JSON", status: 400, cause });
    }
    return { data: await setCostingRates(body, user.id) };
  });
}
