/* Test helper: records a pass for every required check point of a stage (D-040). */
import { checkpointsFor, recordStageChecks } from "../../server/production/stage-checks.service.ts";

export async function passStageChecks(productionOrderId, stageKey, actorId) {
  const points = (await checkpointsFor(stageKey)).filter((point) => point.required);
  if (!points.length) return;
  await recordStageChecks(productionOrderId, stageKey, {
    results: points.map((point) => ({ key: point.key, result: "PASS", ...(point.kind === "measure" ? { value: "within limit" } : {}) })),
  }, actorId);
}
