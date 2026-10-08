import { db } from "../core/database/client";

interface AuditEventInput {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  await db.orm.public.AuditLog.create({
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    requestId: input.requestId ?? null,
    ip: input.ip ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
