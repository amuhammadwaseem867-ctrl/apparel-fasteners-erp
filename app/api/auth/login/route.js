import { NextResponse } from "next/server";

import { loginUser } from "@/server/auth/auth.service";
import { loginSchema } from "@/server/auth/auth.validation";
import { getSessionCookieOptions } from "@/server/auth/session.service";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}

export async function POST(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    const body = await request.json().catch(() => ({}));

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid login payload.",
            details: parsed.error.flatten(),
          },
        },
        {
          status: 400,
        },
      );
    }

    const result = await loginUser(parsed.data, {
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? null,
      requestId,
    });

    const response = NextResponse.json(
      successResponse({
        user: result.user,
        session: result.session,
      }),
      {
        status: 200,
      },
    );

    response.cookies.set(
      "erp_session",
      result.token,
      getSessionCookieOptions(),
    );

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