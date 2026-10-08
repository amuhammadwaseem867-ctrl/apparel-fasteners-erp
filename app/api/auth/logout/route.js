import { NextResponse } from "next/server";

import { logoutUser } from "@/server/auth/auth.service";
import { extractSessionTokenFromRequest } from "@/server/auth/session.service";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";

export async function POST(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    const token = extractSessionTokenFromRequest(request);

    const revoked = await logoutUser(token);

    const response = NextResponse.json(
      successResponse({
        revoked,
      }),
      {
        status: 200,
      },
    );

    response.cookies.set("erp_session", "", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const handled = handleApiError(error, requestId);

    return NextResponse.json(
      handled.body,
      {
        status: handled.status,
      },
    );
  }
}