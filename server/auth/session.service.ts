import { createHash, randomBytes } from "node:crypto";

import { db } from "../core/database/client";
import { resolveUserAccess } from "./authorization.service";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function extractSessionTokenFromRequest(
  request: Request,
): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");

    if (name === "erp_session") {
      const value = valueParts.join("=");

      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

export async function createSessionForUser(
  userId: string,
  token: string,
  metadata?: {
    ip?: string | null;
    userAgent?: string | null;
  },
) {
  const hashedToken = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_MS,
  ).toISOString();

  const session = await db.orm.public.UserSession.create({
    userId,
    tokenHash: hashedToken,
    expiresAt,
    lastUsedAt: new Date().toISOString(),
    ip: metadata?.ip ?? null,
    userAgent: metadata?.userAgent ?? null,
  });

  return {
    id: session.id,
    expiresAt: session.expiresAt,
    token,
  };
}

export async function validateSessionToken(
  token: string | null | undefined,
) {
  if (!token) {
    return null;
  }

  const hashedToken = hashSessionToken(token);

  const session = await db.orm.public.UserSession
    .where({ tokenHash: hashedToken })
    .first();

  if (!session || session.revokedAt) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.orm.public.UserSession
      .where({ id: session.id })
      .update({
        revokedAt: new Date().toISOString(),
      });

    return null;
  }

  const user = await db.orm.public.User
    .where({ id: session.userId })
    .first();

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  await db.orm.public.UserSession
    .where({ id: session.id })
    .update({
      lastUsedAt: new Date().toISOString(),
    });

  return {
    session,
    user: await resolveUserAccess(session.userId),
  };
}

export async function revokeSessionToken(
  token: string | null | undefined,
  revokedBy?: string | null,
): Promise<boolean> {
  if (!token) {
    return false;
  }

  const hashedToken = hashSessionToken(token);

  const session = await db.orm.public.UserSession
    .where({ tokenHash: hashedToken })
    .first();

  if (!session || session.revokedAt) {
    return false;
  }

  await db.orm.public.UserSession
    .where({ id: session.id })
    .update({
      revokedAt: new Date().toISOString(),
      revokedBy: revokedBy ?? null,
    });

  return true;
}

export async function revokeSessionById(
  sessionId: string,
  revokedBy?: string | null,
): Promise<void> {
  await db.orm.public.UserSession
    .where({ id: sessionId })
    .update({
      revokedAt: new Date().toISOString(),
      revokedBy: revokedBy ?? null,
    });
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}