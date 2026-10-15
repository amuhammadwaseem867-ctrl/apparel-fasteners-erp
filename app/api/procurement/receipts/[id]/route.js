import { authorizeAnyRequest } from "@/server/core/api/request";
import { runRoute } from "@/server/core/api/route";
import { getPurchaseReceipt, UUID } from "@/server/procurement/procurement.service";
import { AppError } from "@/server/core/errors/app-error";

export function GET(request, { params }) {
  return runRoute(request, async () => {
    await authorizeAnyRequest(request, ["purchasing:view", "inventory:view"]);
    const { id } = await params;
    if (!UUID.test(id)) throw new AppError("Receipt not found.", { code: "RECEIPT_NOT_FOUND", status: 404 });
    return { data: await getPurchaseReceipt(id) };
  });
}
