import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/core/api/request";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { resolveRequestId } from "@/server/core/utils/request-id";
import {
  getDashboard,
} from "@/server/dashboard/dashboard.service";

const VALID_PERIODS = new Set([
  "today",
  "7d",
  "30d",
  "this_month",
]);

export async function GET(request) {
  const requestId = resolveRequestId(
    request.headers.get("x-request-id"),
  );

  try {
    await authorizeRequest(
      request,
      "dashboard:view",
    );

    const period =
      new URL(request.url).searchParams.get(
        "period",
      ) || "30d";

    if (!VALID_PERIODS.has(period)) {
      throw new AppError(
        "Invalid dashboard period.",
        {
          code: "INVALID_DASHBOARD_PERIOD",
          status: 400,
          details: {
            allowed: [
              "today",
              "7d",
              "30d",
              "this_month",
            ],
          },
        },
      );
    }

    const dashboard = await getDashboard(
      period,
    );

    return NextResponse.json(
      successResponse(dashboard),
    );
  } catch (error) {
    const handled = handleApiError(
      error,
      requestId,
    );

    return NextResponse.json(
      handled.body,
      {
        status: handled.status,
      },
    );
  }
}