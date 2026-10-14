import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/server/auth/audit.service";
import { authorizeRequest } from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import { toCsv } from "@/server/core/utils/csv";
import { resolveRequestId } from "@/server/core/utils/request-id";
import { exportSalesOrders } from "@/server/sales/sales.service";
import { salesOrderQuerySchema } from "@/server/sales/sales.validation";

const HEADERS = [
  "Order number",
  "Order date",
  "Delivery date",
  "Customer",
  "Status",
  "Lines",
  "Order total",
];

export async function GET(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    const user = await authorizeRequest(request, "sales:view");

    const parsed = salesOrderQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    if (!parsed.success) {
      throw new AppError("Invalid sales order filters.", {
        code: "VALIDATION_FAILED",
        status: 400,
        details: parsed.error.issues,
      });
    }

    const { page: _page, pageSize: _pageSize, ...filters } = parsed.data;
    const orders = await exportSalesOrders(filters);

    await recordAuditEvent({
      actorId: user.id,
      action: "SALES_ORDERS_EXPORTED",
      entityType: "SalesOrder",
      requestId,
      metadata: { filters, rows: orders.length },
    });

    const csv = toCsv(
      HEADERS,
      orders.map((order) => [
        order.orderNumber,
        order.orderDate,
        order.deliveryDate ?? "",
        order.customerName,
        order.status,
        order.items,
        order.totalAmount,
      ]),
    );

    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sales-orders-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const handled = handleApiError(error, requestId);

    return NextResponse.json(
      handled.body,
      { status: handled.status },
    );
  }
}
