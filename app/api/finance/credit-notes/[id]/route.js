import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getCreditNote } from "@/server/finance/finance.service";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getCreditNote(id) };
  });
}
