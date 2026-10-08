import { createHash } from "node:crypto";

import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { handleApiError } from "../core/errors/error-handler";
import { logger } from "../core/logger/logger";
import { recordAuditEvent } from "./audit.service";
import { resolveUserAccess } from "./authorization.service";
import {
  createUserSchema,
  loginSchema,
  type LoginInput,
} from "./auth.validation";
import {
  hashPassword,
  verifyPassword,
} from "./password.service";
import {
  createSessionForUser,
  createSessionToken,
  extractSessionTokenFromRequest,
  hashSessionToken,
  revokeSessionToken,
  validateSessionToken,
} from "./session.service";

const failedLoginAttempts = new Map<
  string,
  {
    count: number;
    lastAttemptAt: number;
  }
>();

const LOCKOUT_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function fingerprintEmail(email: string): string {
  return email.trim().toLowerCase();
}

function registerFailedAttempt(email: string): void {
  const key = fingerprintEmail(email);

  const entry =
    failedLoginAttempts.get(key) ?? {
      count: 0,
      lastAttemptAt: 0,
    };

  const count = entry.count + 1;

  failedLoginAttempts.set(key, {
    count,
    lastAttemptAt: Date.now(),
  });

  if (count >= MAX_ATTEMPTS) {
    logger.warn("Authentication lockout triggered.", {
      email: key,
    });
  }
}

function isRateLimited(email: string): boolean {
  const key = fingerprintEmail(email);
  const entry = failedLoginAttempts.get(key);

  if (!entry) {
    return false;
  }

  const elapsed = Date.now() - entry.lastAttemptAt;

  if (elapsed > LOCKOUT_MS) {
    failedLoginAttempts.delete(key);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

export async function createUser(
  input: {
    employeeCode: string;
    name: string;
    email: string;
    phone?: string | null;
    password: string;
    roles?: string[];
  },
  actorId?: string | null,
) {
  const parsed = createUserSchema.parse(input);

  const email = parsed.email.trim().toLowerCase();
  const employeeCode = parsed.employeeCode.trim();

  const existingUser = await db.orm.public.User
    .where({ email })
    .first();

  const existingEmployeeCode = await db.orm.public.User
    .where({ employeeCode })
    .first();

  if (existingUser || existingEmployeeCode) {
    throw new AppError(
      "A user with that email or employee code already exists.",
      {
        code: "USER_EXISTS",
        status: 409,
      },
    );
  }

  const passwordHash = hashPassword(parsed.password);

  const user = await db.transaction(async (tx) => {
    const createdUser = await tx.orm.public.User.create({
      employeeCode,
      name: parsed.name,
      email,
      phone:
        parsed.phone && parsed.phone.trim().length > 0
          ? parsed.phone.trim()
          : null,
      passwordHash,
      status: "ACTIVE",
    });

    if (parsed.roles.length > 0) {
      const roleMatches = await tx.orm.public.Role
        .where((row) => row.code.in(parsed.roles))
        .select("id", "code")
        .all();

      if (roleMatches.length !== parsed.roles.length) {
        throw new AppError(
          "One or more invalid roles were provided.",
          {
            code: "INVALID_ROLE",
            status: 400,
          },
        );
      }

      for (const role of roleMatches) {
        await tx.orm.public.UserRole.create({
          userId: createdUser.id,
          roleId: role.id,
        });
      }
    }

    return createdUser;
  });

  await recordAuditEvent({
    actorId: actorId ?? null,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email,
      employeeCode,
    },
  });

  return resolveUserAccess(user.id);
}

export async function loginUser(
  payload: LoginInput,
  sessionMetadata?: {
    ip?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
  },
) {
  const validPayload = loginSchema.parse(payload);
  const email = fingerprintEmail(validPayload.email);

  if (isRateLimited(email)) {
    throw new AppError(
      "Authentication temporarily locked. Please try again later.",
      {
        code: "AUTH_LOCKED",
        status: 429,
      },
    );
  }

  const user = await db.orm.public.User
    .where({ email })
    .first();

  if (!user || !verifyPassword(validPayload.password, user.passwordHash)) {
    registerFailedAttempt(email);

    await recordAuditEvent({
      action: "LOGIN_FAILURE",
      entityType: "User",
      entityId: user?.id ?? null,
      requestId: sessionMetadata?.requestId ?? null,
      ip: sessionMetadata?.ip ?? null,
      metadata: {
        email,
      },
    });

    throw new AppError("Invalid email or password.", {
      code: "AUTH_INVALID",
      status: 401,
    });
  }

  if (user.status !== "ACTIVE") {
    registerFailedAttempt(email);

    await recordAuditEvent({
      action: "LOGIN_FAILURE",
      entityType: "User",
      entityId: user.id,
      requestId: sessionMetadata?.requestId ?? null,
      ip: sessionMetadata?.ip ?? null,
      metadata: {
        reason: "disabled_user",
        email,
      },
    });

    throw new AppError("Invalid email or password.", {
      code: "AUTH_INVALID",
      status: 401,
    });
  }

  failedLoginAttempts.delete(email);

  const sessionToken = createSessionToken();

  const session = await createSessionForUser(
    user.id,
    sessionToken,
    {
      ip: sessionMetadata?.ip ?? null,
      userAgent: sessionMetadata?.userAgent ?? null,
    },
  );

  await db.orm.public.User
    .where({ id: user.id })
    .update({
      lastLoginAt: new Date().toISOString(),
    });

  await recordAuditEvent({
    actorId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
    requestId: sessionMetadata?.requestId ?? null,
    ip: sessionMetadata?.ip ?? null,
    metadata: {
      email,
    },
  });

  return {
    token: sessionToken,
    user: await resolveUserAccess(user.id),
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
}

export async function logoutUser(
  token: string | null | undefined,
  actorId?: string | null,
): Promise<boolean> {
  if (!token) {
    return false;
  }

  const hashedToken = hashSessionToken(token);

  const session = await db.orm.public.UserSession
    .where({ tokenHash: hashedToken })
    .first();

  if (!session) {
    return false;
  }

  const revoked = await revokeSessionToken(
    token,
    actorId ?? session.userId,
  );

  if (revoked) {
    await recordAuditEvent({
      actorId: actorId ?? session.userId,
      action: "LOGOUT",
      entityType: "UserSession",
      entityId: session.id,
      metadata: {
        revoked: true,
      },
    });
  }

  return revoked;
}

export async function getCurrentUser(
  cookieToken: string | null | undefined,
) {
  const validation = await validateSessionToken(cookieToken);

  if (!validation) {
    return null;
  }

  return validation.user;
}

export async function readCurrentUserFromRequest(
  request: Request,
) {
  const token = extractSessionTokenFromRequest(request);

  return getCurrentUser(token);
}

export function handleAuthError(
  error: unknown,
  requestId?: string,
) {
  return handleApiError(error, requestId);
}