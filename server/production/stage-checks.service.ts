/*
 * Production check points (D-040). Each of stages 1–6 has a checklist set
 * by the owner (Settings → Production check points). While a stage is in
 * progress its checks are recorded as Pass, Fail or Not applicable, with
 * the measured value for a measurement. A stage completes only when every
 * required check has passed: a failed check blocks it until it is fixed
 * and checked again. Re-checking replaces the result; the audit log keeps
 * every change.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { getSetting, type Checkpoint } from "../settings/settings.service";
import type { StageChecksInput } from "./production.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CheckRow = { checkKey: string; result: string; value: string | null; note: string | null; label: string; checkedBy: string; checkedAt: string };

export async function checkpointsFor(stageKey: string): Promise<Checkpoint[]> {
  const setting = await getSetting("production.checkpoints");
  return (setting.stages as Record<string, Checkpoint[]>)[stageKey] ?? [];
}

export async function allCheckpoints(): Promise<Record<string, Checkpoint[]>> {
  return (await getSetting("production.checkpoints")).stages as Record<string, Checkpoint[]>;
}

/* What still stands between a stage and completion, or null when its checks allow it. */
export function checksProblem(points: Checkpoint[], rows: Array<Pick<CheckRow, "checkKey" | "result">>) {
  const result = (key: string) => rows.find((row) => row.checkKey === key)?.result;
  const failed = points.filter((point) => result(point.key) === "FAIL");
  if (failed.length) return `Failed check: ${failed.map((point) => point.label).join("; ")}. Fix it and check again before completing.`;
  const missing = points.filter((point) => point.required && !["PASS", "NA"].includes(result(point.key) ?? ""));
  if (missing.length) return `Record the check points first: ${missing.map((point) => point.label).join("; ")}.`;
  return null;
}

/* Every stage's check points with their recorded results, for one order. */
export async function stageChecksFor(productionOrderId: string) {
  const [points, rows] = await Promise.all([
    allCheckpoints(),
    db.orm.public.ProductionStageCheck.where({ productionOrderId }).all(),
  ]);
  const userIds = [...new Set(rows.map((row) => row.checkedBy))];
  const users = userIds.length ? await db.orm.public.User.where((user) => user.id.in(userIds)).select("id", "name").all() : [];
  const name = (id: string) => users.find((user) => user.id === id)?.name ?? null;
  return (stageKey: string) => {
    const own = rows.filter((row) => row.stageKey === stageKey);
    const defined = points[stageKey] ?? [];
    return {
      points: defined.map((point) => {
        const row = own.find((item) => item.checkKey === point.key);
        return { ...point, result: row?.result ?? null, value: row?.value ?? null, note: row?.note ?? null, checkedByName: row ? name(row.checkedBy) : null, checkedAt: row?.checkedAt ?? null };
      }),
      // Checks recorded against a point the owner has since removed stay visible.
      retired: own.filter((row) => !defined.some((point) => point.key === row.checkKey)).map((row) => ({ key: row.checkKey, label: row.label, result: row.result, value: row.value, note: row.note })),
      problem: checksProblem(defined, own),
    };
  };
}

export async function recordStageChecks(productionOrderId: string, stageKey: string, input: StageChecksInput, actorId: string) {
  if (!UUID.test(productionOrderId)) throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 404 });
  const points = await checkpointsFor(stageKey);
  if (!points.length) throw new AppError("This stage has no check points.", { code: "STAGE_HAS_NO_CHECKS", status: 400 });

  for (const item of input.results) {
    const point = points.find((candidate) => candidate.key === item.key);
    if (!point) throw new AppError(`Unknown check point "${item.key}".`, { code: "CHECKPOINT_NOT_FOUND", status: 400 });
    if (item.result === "NA" && point.required) throw new AppError(`"${point.label}" is required; it cannot be marked not applicable.`, { code: "CHECKPOINT_REQUIRED", status: 400 });
    if (point.kind === "measure" && item.result !== "NA" && !item.value?.trim()) throw new AppError(`Enter the measured value for "${point.label}".`, { code: "CHECKPOINT_VALUE_REQUIRED", status: 400 });
    if (item.result === "FAIL" && !item.note?.trim()) throw new AppError(`Write what was wrong with "${point.label}".`, { code: "CHECKPOINT_NOTE_REQUIRED", status: 400 });
  }

  await db.transaction(async (tx) => {
    const locked = (await tx.query(db.raw.sql`
      select status from erp_production_orders where id = ${productionOrderId}::uuid for update
    `.returnsRow({ status: "pg/text@1" }).build() as never)) as unknown as Array<{ status: string }>;
    if (!locked.length) throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 404 });
    if (!["RELEASED", "IN_PROGRESS", "COMPLETED"].includes(locked[0].status)) {
      throw new AppError(`Checks cannot be recorded while the order is ${locked[0].status.toLowerCase().replace("_", " ")}.`, { code: "PRODUCTION_STATUS_CONFLICT", status: 409 });
    }
    const stage = await tx.orm.public.ProductionStage.where({ productionOrderId, stageKey }).first();
    if (!stage) throw new AppError("Unknown stage.", { code: "STAGE_NOT_FOUND", status: 404 });
    if (stage.status !== "IN_PROGRESS") {
      throw new AppError(stage.status === "PENDING" ? "Start the stage before recording its checks." : "This stage is already completed.", { code: "STAGE_STATUS_CONFLICT", status: 409 });
    }
    for (const item of input.results) {
      const point = points.find((candidate) => candidate.key === item.key)!;
      await tx.query(db.raw.sql`
        insert into erp_production_stage_checks (id, "productionOrderId", "stageKey", "checkKey", label, result, value, note, "checkedBy", "checkedAt")
        values (gen_random_uuid(), ${productionOrderId}::uuid, ${stageKey}, ${item.key}, ${point.label}, ${item.result}, nullif(${item.value?.trim() ?? ""}, ''), nullif(${item.note?.trim() ?? ""}, ''), ${actorId}::uuid, now())
        on conflict ("productionOrderId", "stageKey", "checkKey") do update
          set label = excluded.label, result = excluded.result, value = excluded.value, note = excluded.note, "checkedBy" = excluded."checkedBy", "checkedAt" = excluded."checkedAt"
        returning id
      `.returnsRow({ id: "pg/text@1" }).build() as never);
    }
    await recordAuditEvent({
      actorId,
      action: "STAGE_CHECKS_RECORDED",
      entityType: "ProductionOrder",
      entityId: productionOrderId,
      metadata: { stageKey, results: input.results.map((item) => ({ key: item.key, result: item.result, value: item.value ?? null })) },
    }, tx);
  });

  return (await stageChecksFor(productionOrderId))(stageKey);
}
