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

type AuditWriter = Pick<typeof db, "orm">;

/*
 * Pass a transaction context as `client` to write the audit row inside that
 * transaction, so the business change and its audit event commit or roll
 * back together.
 */
export async function recordAuditEvent(
  input: AuditEventInput,
  client: AuditWriter = db,
): Promise<void> {
  await client.orm.public.AuditLog.create({
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    requestId: input.requestId ?? null,
    ip: input.ip ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
