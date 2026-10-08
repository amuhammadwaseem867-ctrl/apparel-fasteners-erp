import { NextResponse } from "next/server";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import {
  createSalesOrder,
  listSalesOrders,
} from "@/server/sales/sales.service";
import {
  salesOrderInputSchema,
  salesOrderQuerySchema,
} from "@/server/sales/sales.validation";

export async function GET(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    await authorizeRequest(request, "sales:view");

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

    const result = await listSalesOrders(parsed.data);

    return NextResponse.json(
      successResponse(result),
      { status: 200 },
    );
  } catch (error) {
    const handled = handleApiError(error, requestId);

    return NextResponse.json(
      handled.body,
      { status: handled.status },
    );
  }
}

export async function POST(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    const user = await authorizeRequest(
      request,
      "sales:create",
    );

    const input = await parseRequestBody(
      request,
      salesOrderInputSchema,
    );

    const order = await createSalesOrder(
      input,
      user.id,
    );

    return NextResponse.json(
      successResponse(order),
      { status: 201 },
    );
  } catch (error) {
    const handled = handleApiError(error, requestId);

    return NextResponse.json(
      handled.body,
      { status: handled.status },
    );
  }
}
