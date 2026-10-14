import { NextResponse } from "next/server";

import { AppError } from "../errors/app-error";
import { handleApiError } from "../errors/error-handler";
import { successResponse } from "../response/api-response";
import { resolveRequestId } from "../utils/request-id";

/*
 * Shared route wrapper: resolves the request id, runs the handler and maps
 * any thrown error to the standard failure envelope (same behaviour as the
 * hand-written try/catch in the existing routes).
 */
export async function runRoute(
  request: Request,
  handler: () => Promise<{ data: unknown; status?: number }>,
) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));

  try {
    const { data, status = 200 } = await handler();
    return NextResponse.json(successResponse(data), { status });
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export function parseQuery<T>(
  request: Request,
  schema: {
    safeParse: (value: unknown) =>
      | { success: true; data: T }
      | { success: false; error: { issues: unknown } };
  },
): T {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    throw new AppError("Invalid filters.", {
      code: "VALIDATION_FAILED",
      status: 400,
      details: parsed.error.issues,
    });
  }

  return parsed.data;
}
