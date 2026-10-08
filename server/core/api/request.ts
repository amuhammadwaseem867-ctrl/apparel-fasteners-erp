import { AppError } from "../errors/app-error";
import { getCurrentUser } from "../../auth/auth.service";
import { extractSessionTokenFromRequest } from "../../auth/session.service";
import { requirePermission } from "../../auth/authorization.service";

export async function authorizeRequest(
  request: Request,
  permission: string,
) {
  const token = extractSessionTokenFromRequest(request);
  const user = await getCurrentUser(token);

  if (!user) {
    throw new AppError("Authentication is required.", {
      code: "AUTH_REQUIRED",
      status: 401,
    });
  }

  await requirePermission(user.id, permission);
  return user;
}

export async function parseRequestBody<T>(
  request: Request,
  schema: {
    safeParse: (value: unknown) =>
      | { success: true; data: T }
      | { success: false; error: { issues: unknown } };
  },
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (cause) {
    throw new AppError("Request body must be valid JSON.", {
      code: "INVALID_JSON",
      status: 400,
      cause,
    });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("Request validation failed.", {
      code: "VALIDATION_FAILED",
      status: 400,
      details: parsed.error.issues,
    });
  }

  return parsed.data;
}
