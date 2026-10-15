import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditEvent } from "@/server/auth/audit.service";
import { getCurrentUser } from "@/server/auth/auth.service";
import { extractSessionTokenFromRequest } from "@/server/auth/session.service";
import { AppError } from "@/server/core/errors/app-error";
import { handleApiError } from "@/server/core/errors/error-handler";
import { successResponse } from "@/server/core/response/api-response";
import { toCsv } from "@/server/core/utils/csv";
import { resolveRequestId } from "@/server/core/utils/request-id";
import { reportPermissions, runReport } from "@/server/reports/reports.service";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const querySchema = z.object({ from: date, to: date, format: z.enum(["json", "csv", ""]).default("") });

/*
 * GET /api/reports/[report]?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv]
 * Needs any one of the report's permissions (its module's view permission
 * or reports:view; payroll needs payroll:view). CSV downloads are audited.
 */
export async function GET(request, { params }) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    const user = await getCurrentUser(extractSessionTokenFromRequest(request));
    if (!user) throw new AppError("Authentication is required.", { code: "AUTH_REQUIRED", status: 401 });

    const { report } = await params;
    const allowed = reportPermissions(report);
    if (!allowed.some((permission) => user.permissions.includes(permission))) {
      throw new AppError("You do not have permission to view this report.", { code: "FORBIDDEN", status: 403 });
    }

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      throw new AppError("Invalid report filters.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
    }

    const result = await runReport(report, { from: parsed.data.from, to: parsed.data.to });

    if (parsed.data.format === "csv") {
      const csv = toCsv(result.columns.map((column) => column.label), result.rows.map((row) => result.columns.map((column) => row[column.key] ?? "")));
      await recordAuditEvent({
        actorId: user.id,
        action: "REPORT_EXPORTED",
        entityType: "Report",
        entityId: report,
        requestId,
        metadata: { from: result.from, to: result.to, rows: result.rows.length },
      });
      const stamp = result.dated ? `${result.from}_${result.to}` : result.generatedAt.slice(0, 10);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${report}_${stamp}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    return NextResponse.json(successResponse(result), { status: 200 });
  } catch (error) {
    const handled = handleApiError(error, requestId);
    return NextResponse.json(handled.body, { status: handled.status });
  }
}
