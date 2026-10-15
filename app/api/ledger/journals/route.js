import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listJournalEntries, postManualJournal } from "@/server/ledger/ledger.service";
import { journalInputSchema, journalQuerySchema } from "@/server/ledger/ledger.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: await listJournalEntries(parseQuery(request, journalQuerySchema)) };
  });
}

/* Manual journal: balanced, at least two lines (finance:approve). */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    return { data: await postManualJournal(await parseRequestBody(request, journalInputSchema), user.id), status: 201 };
  });
}
