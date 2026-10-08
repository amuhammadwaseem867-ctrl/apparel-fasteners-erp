import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeRequest,
  parseRequestBody,
} from "@/server/core/api/request";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import {
  changeSalesOrderStatus,
  getSalesOrder,
  updateSalesOrder,
} from "@/server/sales/sales.service";
import { salesOrderInputSchema } from "@/server/sales/sales.validation";

const statusActionSchema = z.object({
  action: z.enum(["approve", "cancel"]),
});

export async function GET(request, { params }) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    await authorizeRequest(request, "sales:view");

    const { id } = await params;
    const order = await getSalesOrder(id);

    return NextResponse.json(
      successResponse(order),
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

export async function PUT(request, { params }) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    const user = await authorizeRequest(
      request,
      "sales:update",
    );

    const input = await parseRequestBody(
      request,
      salesOrderInputSchema,
    );

    const { id } = await params;

    const order = await updateSalesOrder(
      id,
      input,
      user.id,
    );

    return NextResponse.json(
      successResponse(order),
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

export async function PATCH(request, { params }) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    const input = await parseRequestBody(
      request,
      statusActionSchema,
    );

    const permission =
      input.action === "approve"
        ? "sales:approve"
        : "sales:update";

    const user = await authorizeRequest(
      request,
      permission,
    );

    const { id } = await params;

    const order = await changeSalesOrderStatus(
      id,
      input.action,
      user.id,
    );

    return NextResponse.json(
      successResponse(order),
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
