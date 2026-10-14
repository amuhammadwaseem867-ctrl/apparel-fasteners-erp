import { requirePermission } from "@/server/auth/authorization.service";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { listStockDocuments, postStockDocument } from "@/server/inventory/inventory.service";
import { documentQuerySchema, stockDocumentInputSchema } from "@/server/inventory/inventory.validation";
import { documentTypeRule } from "@/server/inventory/stock-rules";

export function GET(request) {
  return runRoute(request, async () => {
    await authorizeRequest(request, "inventory:view");
    return { data: await listStockDocuments(parseQuery(request, documentQuerySchema)) };
  });
}

/*
 * Posts a stock transaction. Each document type requires its own
 * permission (receipts/issues: inventory:create, transfers:
 * inventory:transfer, adjustments/counts/QC: inventory:adjust).
 * A replayed idempotency key answers 200 with the original document.
 */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:view");
    const input = await parseRequestBody(request, stockDocumentInputSchema);
    await requirePermission(user.id, documentTypeRule(input.documentType).permission);
    const result = await postStockDocument(input, user.id);
    return { data: result, status: result.replayed ? 200 : 201 };
  });
}
