import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import { failureResponse, successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import { createCustomer, listCustomers } from "@/server/sales/sales.service";
import { customerInputSchema } from "@/server/sales/sales.validation";

const customerQuerySchema = z.object({
  search: z.string().trim().max(180).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    await authorizeRequest(request, "customers:view");
    const parsed = customerQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) {
      throw new AppError("Invalid customer filters.", {
        code: "VALIDATION_FAILED",
        status: 400,
        details: parsed.error.issues,
      });
    }
    return NextResponse.json(successResponse(await listCustomers(
      parsed.data.search,
      parsed.data.page,
      parsed.data.pageSize,
    )));
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export async function POST(request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    const user = await authorizeRequest(request, "customers:create");
    const input = await parseRequestBody(request, customerInputSchema);
    const customer = await createCustomer(input, user.id);
    return NextResponse.json(successResponse(customer), { status: 201 });
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}
