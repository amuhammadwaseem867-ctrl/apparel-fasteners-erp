import { z } from "zod";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listMrpRuns, runMrp } from "@/server/planning/mrp.service";
import { mrpRunInputSchema } from "@/server/planning/planning.validation";

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "production:view");
    const { page, pageSize } = parseQuery(request, pageSchema);
    return { data: await listMrpRuns(page, pageSize) };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "production:create");
    const input = await parseRequestBody(request, mrpRunInputSchema);
    return { data: await runMrp(input, user.id), status: 201 };
  });
}
