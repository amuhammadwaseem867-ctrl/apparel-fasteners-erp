import { NextResponse } from "next/server";

import {
  changeUserPassword,
  getCurrentUser,
} from "@/server/auth/auth.service";
import {
  extractSessionTokenFromRequest,
  validateSessionToken,
} from "@/server/auth/session.service";
import { handleApiError } from "@/server/core/errors/error-handler";
import {
  failureResponse,
  successResponse,
} from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";

export async function POST(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    const token = extractSessionTokenFromRequest(request);

    const user = await getCurrentUser(token);

    if (!user) {
      return NextResponse.json(
        failureResponse(
          "AUTH_REQUIRED",
          "Authentication is required.",
        ),
        { status: 401 },
      );
    }

    const sessionValidation = await validateSessionToken(token);

    if (!sessionValidation) {
      return NextResponse.json(
        failureResponse(
          "AUTH_REQUIRED",
          "Your session has expired.",
        ),
        { status: 401 },
      );
    }

    const body = await request.json();

    await changeUserPassword(
      user.id,
      body?.currentPassword,
      body?.newPassword,
      sessionValidation.session.id,
    );

    return NextResponse.json(
      successResponse({
        message:
          "Password changed successfully. Other active sessions were signed out.",
      }),
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
