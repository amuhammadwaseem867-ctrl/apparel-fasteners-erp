import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getJournalEntry, reverseManualJournal } from "@/server/ledger/ledger.service";
import { reverseSchema } from "@/server/ledger/ledger.validation";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { id } = await params;
    return { data: await getJournalEntry(id) };
  });
}

/* POST { entryDate, reason } reverses a manual entry once (finance:approve). */
export function POST(request, { params }) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const { entryDate, reason } = await parseRequestBody(request, reverseSchema);
    const { id } = await params;
    return { data: await reverseManualJournal(id, entryDate, reason, user.id), status: 201 };
  });
}
