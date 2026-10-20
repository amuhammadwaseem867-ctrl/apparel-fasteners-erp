import { requirePermission } from "@/server/auth/authorization.service";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { parseQuery, runRoute } from "@/server/core/api/route";
import { AppError } from "@/server/core/errors/app-error";
import { listStockDocuments, postStockDocument, resolveTypedLocation } from "@/server/inventory/inventory.service";
import { documentQuerySchema, stockDocumentInputSchema, stockDocumentRequestSchema } from "@/server/inventory/inventory.validation";
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
 * A line may give a typed location name instead of an id; it is found or
 * created in the warehouse once the transaction is valid and the user's
 * permission is confirmed.
 */
export function POST(request) {
  return runRoute(request, async () => {
    const user = await authorizeRequest(request, "inventory:view");
    const body = await parseRequestBody(request, stockDocumentRequestSchema);
    // Check the whole transaction first (typed locations stand in as placeholders),
    // so nothing is created for a transaction that would be rejected.
    const placeholder = (index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const check = (lines) => {
      const parsed = stockDocumentInputSchema.safeParse({ ...body, lines });
      if (!parsed.success) {
        throw new AppError("Invalid stock transaction.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
      }
      return parsed.data;
    };
    const strip = (line) => Object.fromEntries(Object.entries(line).filter(([key]) => key !== "locationName"));
    const checked = check(body.lines.map((line, index) => ({ ...strip(line), locationId: line.locationId ?? placeholder(index) })));
    await requirePermission(user.id, documentTypeRule(checked.documentType).permission);

    const lines = [];
    for (const line of body.lines) {
      lines.push({ ...strip(line), locationId: line.locationId ?? await resolveTypedLocation(line.locationName, user.id) });
    }
    const result = await postStockDocument(check(lines), user.id);
    return { data: result, status: result.replayed ? 200 : 201 };
  });
}
