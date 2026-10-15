import { authorizeRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { recordAuditEvent } from "@/server/auth/audit.service";
import { postMissingDocuments } from "@/server/ledger/postings";

/*
 * POST posts every document that has no ledger entry yet (records made
 * before the ledger existed), with their own dates. Idempotent.
 */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const posted = await postMissingDocuments(user.id);
    await recordAuditEvent({ actorId: user.id, action: "LEDGER_BACKFILL", entityType: "JournalEntry", entityId: null, metadata: posted });
    return { data: { posted } };
  });
}
