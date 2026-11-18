import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { listCostingRecords, saveQuickCosting } from "@/server/costing/costing.service";

/* Costing history (D-060): list, and save a quick costing. Never an order or invoice. */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "sales:view");
    return { data: await listCostingRecords(Object.fromEntries(new URL(request.url).searchParams)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "sales:view");
    let body;
    try {
      body = await request.json();
    } catch (cause) {
      throw new AppError("Request body must be valid JSON.", { code: "INVALID_JSON", status: 400, cause });
    }
    return { data: await saveQuickCosting(body, user.id) };
  });
}
