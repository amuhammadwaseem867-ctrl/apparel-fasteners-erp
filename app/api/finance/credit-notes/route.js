import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { createCreditNote } from "@/server/finance/finance.service";
import { creditNoteInputSchema } from "@/server/finance/finance.validation";

/* Credit notes are final when created, so they need finance:approve. */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    const input = await parseRequestBody(request, creditNoteInputSchema);
    return { data: await createCreditNote(input, user.id), status: 201 };
  });
}
