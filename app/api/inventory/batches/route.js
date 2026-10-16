import { authorizeAnyRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createBatch, listBatches } from "@/server/inventory/batches.service";
import { batchInputSchema, listSchema } from "@/server/planning/scheduling.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["inventory:view", "quality:view"]);
    return { data: await listBatches(parseQuery(request, listSchema)) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeAnyRequest(request, ["inventory:create", "quality:create"]);
    return { data: await createBatch(await parseRequestBody(request, batchInputSchema), user.id), status: 201 };
  });
}
