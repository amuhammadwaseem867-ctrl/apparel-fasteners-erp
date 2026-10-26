import { NextResponse } from "next/server";
import { z } from "zod";

import { hasPermission } from "@/server/auth/authorization.service";
import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import { failureResponse, successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import { customerBalances } from "@/server/finance/customer-ledger";
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
    const user = await authorizeRequest(request, "customers:view");
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
    const result = await listCustomers(
      parsed.data.search,
      parsed.data.page,
      parsed.data.pageSize,
    );
    // Each customer's ledger balance, for users who may see money (D-052).
    if (await hasPermission(user.id, "finance:view")) {
      const balances = await customerBalances(result.customers.map((customer) => customer.id));
      result.customers = result.customers.map((customer) => ({ ...customer, balance: balances.get(customer.id) ?? "0.00" }));
    }
    return NextResponse.json(successResponse(result));
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
