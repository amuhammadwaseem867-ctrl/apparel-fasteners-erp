import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/auth.service";
import { extractSessionTokenFromRequest } from "@/server/auth/session.service";
import { handleApiError } from "@/server/core/errors/error-handler";
import { failureResponse, successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";

export async function GET(request) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));

  try {
    const token = extractSessionTokenFromRequest(request);
    const user = await getCurrentUser(token);

    if (!user) {
      return NextResponse.json(
        failureResponse("AUTH_REQUIRED", "Authentication is required."),
        { status: 401 },
      );
    }

    return NextResponse.json(
      successResponse({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        roles: user.roles,
        permissions: user.permissions,
      }),
      { status: 200 },
    );
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}
