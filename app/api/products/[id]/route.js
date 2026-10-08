import { NextResponse } from "next/server";

import { authorizeRequest, parseRequestBody } from "@/server/core/api/request";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import { archiveProduct, getProduct, updateProduct } from "@/server/products/product.service";
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
    return NextResponse.json(successResponse(await archiveProduct(id, user.id)));
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}
