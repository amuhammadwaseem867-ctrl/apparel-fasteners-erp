import { NextResponse } from "next/server";

import {
  authorizeRequest,
  parseRequestBody,
} from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import {
  successResponse,
} from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import {
  createProduct,
  listProducts,
} from "@/server/products/product.service";
import {
  productInputSchema,
  productQuerySchema,
} from "@/server/products/product.validation";

export async function GET(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    await authorizeRequest(request, "products:view");

    const params = Object.fromEntries(
      new URL(request.url).searchParams,
    );

    const parsed = productQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw new AppError("Invalid product filters.", {
        code: "VALIDATION_FAILED",
        status: 400,
        details: parsed.error.issues,
      });
    }

    const result = await listProducts(parsed.data);

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
      "products:create",
    );

    const input = await parseRequestBody(
      request,
      productInputSchema,
    );

    const product = await createProduct(
      input,
      user.id,
    );

    return NextResponse.json(
      successResponse(product),
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
