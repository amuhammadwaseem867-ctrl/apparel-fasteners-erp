import { NextResponse } from "next/server";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import {
  archiveProduct,
  deleteProductPermanently,
  getProduct,
  restoreProduct,
  updateProduct,
} from "@/server/products/product.service";
import { productInputSchema } from "@/server/products/product.validation";

export async function GET(request, { params }) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    await authorizeRequest(request, "products:view");
    const { id } = await params;
    return NextResponse.json(successResponse(await getProduct(id)));
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export async function PUT(request, { params }) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    const user = await authorizeRequest(request, "products:update");
    const input = await parseRequestBody(request, productInputSchema);
    const { id } = await params;
    return NextResponse.json(successResponse(await updateProduct(id, input, user.id)));
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export async function DELETE(request, { params }) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    const user = await authorizeRequest(request, "products:delete");
    const { id } = await params;
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";
    const result = permanent
      ? await deleteProductPermanently(id, user.id)
      : await archiveProduct(id, user.id);
    return NextResponse.json(successResponse(result));
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}

/* PATCH { "action": "restore" } brings an archived item back as INACTIVE. */
export async function PATCH(request, { params }) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    const user = await authorizeRequest(request, "products:update");
    const body = await request.json().catch(() => null);
    if (body?.action !== "restore") {
      throw new AppError("Unsupported product action.", {
        code: "VALIDATION_FAILED",
        status: 400,
        details: { allowed: ["restore"] },
      });
    }
    const { id } = await params;
    return NextResponse.json(successResponse(await restoreProduct(id, user.id)));
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}
