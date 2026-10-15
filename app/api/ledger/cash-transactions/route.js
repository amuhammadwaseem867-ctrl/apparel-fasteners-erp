import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listCashTransactions, recordCashTransaction } from "@/server/ledger/ledger.service";
import { cashQuerySchema, cashTransactionInputSchema } from "@/server/ledger/ledger.validation";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    return { data: await listCashTransactions(parseQuery(request, cashQuerySchema)) };
  });
}

/* Expense, other income or transfer between cash/bank accounts (finance:create). */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "finance:create");
    return { data: await recordCashTransaction(await parseRequestBody(request, cashTransactionInputSchema), user.id), status: 201 };
  });
}
