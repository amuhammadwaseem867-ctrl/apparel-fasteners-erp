import { authorizeRequest } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { getBalanceSheet, getProfitAndLoss, getTrialBalance } from "@/server/ledger/ledger.service";
import { rangeQuerySchema } from "@/server/ledger/ledger.validation";

/* GET trial-balance?to= | profit-and-loss?from&to | balance-sheet?to= */
export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "finance:view");
    const { statement } = await params;
    const { from, to } = parseQuery(request, rangeQuerySchema);
    const end = to || new Date().toISOString().slice(0, 10);
    if (statement === "trial-balance") return { data: await getTrialBalance(end) };
    if (statement === "balance-sheet") return { data: await getBalanceSheet(end) };
    if (statement === "profit-and-loss") return { data: await getProfitAndLoss(from || `${end.slice(0, 4)}-01-01`, end) };
    throw new AppError("Statement not found.", { code: "STATEMENT_NOT_FOUND", status: 404 });
  });
}
