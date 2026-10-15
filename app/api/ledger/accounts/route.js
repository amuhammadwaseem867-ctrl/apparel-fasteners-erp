import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { createAccount, listAccounts } from "@/server/ledger/ledger.service";
import { accountInputSchema, asOfQuerySchema } from "@/server/ledger/ledger.validation";

/* Chart of accounts with balances as of a date. */
export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { asOf } = parseQuery(request, asOfQuerySchema);
    return { data: { accounts: await listAccounts(asOf || undefined) } };
  });
}

export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:approve");
    return { data: await createAccount(await parseRequestBody(request, accountInputSchema), user.id), status: 201 };
  });
}
