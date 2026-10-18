/*
 * Administrator-managed settings (D-035), stored as JSON per key.
 *
 * company.profile   Printed on documents. Defaults to config/company.js
 *                   (only the trading name is known; nothing is invented).
 * planning.weeklyOff  Days of the week that are not worked (0 = Sunday).
 *                   Default: Sunday only, until the owner sets it.
 */

import { z } from "zod";

import { COMPANY } from "../../config/company.js";
import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";

const text = (max: number) => z.string().trim().max(max).default("");

/*
 * Production check points (D-040): stages 1–6. Quality Check, Packing and
 * Delivered are checked by their own documents (inspection, packing list,
 * shipment). The defaults follow common zipper practice; the limits are
 * left for the owner to fill from the buyers' specifications.
 */
export const CHECKED_STAGES = ["tape-dyeing", "tape-press", "teeth-making", "plating", "lacquer-wax", "assembling"];

const checkpointSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Use lower-case letters, numbers and dashes."),
  label: z.string().trim().min(3).max(160),
  kind: z.enum(["check", "measure"]).default("check"),
  unit: text(20),
  limit: text(120),
  required: z.boolean().default(true),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;

const point = (key: string, label: string, extra: Partial<Checkpoint> = {}): Checkpoint => ({ key, label, kind: "check", unit: "", limit: "", required: true, ...extra });

export const DEFAULT_CHECKPOINTS: Record<string, Checkpoint[]> = {
  "tape-dyeing": [
    point("shade-match", "Shade matches the approved sample (light box)"),
    point("shade-even", "Shade even across the whole lot"),
    point("color-fastness", "Colour fastness checked (washing / rubbing)"),
    point("shrinkage", "Tape shrinkage", { kind: "measure", unit: "%" }),
  ],
  "tape-press": [
    point("tape-width", "Tape width", { kind: "measure", unit: "mm" }),
    point("tape-surface", "No creases, stains or burn marks"),
  ],
  "teeth-making": [
    point("first-piece", "First piece approved"),
    point("teeth-size", "Teeth size and gap (caliper)", { kind: "measure", unit: "mm" }),
    point("teeth-complete", "No missing or bent teeth"),
    point("teeth-grip", "Teeth firmly fixed on the tape"),
  ],
  plating: [
    point("finish-match", "Finish matches the standard sample"),
    point("plating-adhesion", "No peeling, flaking or spots"),
    point("salt-spray", "Salt spray / nickel test (when the buyer requires it)", { required: false }),
  ],
  "lacquer-wax": [
    point("coating-even", "Coating even and not sticky"),
    point("runs-smooth", "Zipper runs smoothly"),
  ],
  assembling: [
    point("slider-correct", "Correct slider, finish and size"),
    point("stops-fixed", "Top and bottom stops fixed in place"),
    point("length", "Length as ordered", { kind: "measure", unit: "inch" }),
    point("strength-sample", "Slider pull-off and stop holding sample test"),
  ],
};

export const SETTINGS = {
  "company.profile": {
    label: "Company profile",
    schema: z.object({
      name: z.string().trim().min(2).max(120),
      legalName: text(160),
      address: text(300),
      phone: text(60),
      email: z.string().trim().email().max(200).or(z.literal("")).default(""),
      taxRegistration: text(60),
      website: text(120),
      // Printed on the sales tax invoice (AF7 company documents).
      bankName: text(120),
      accountName: text(160),
      accountNumber: text(60),
      iban: text(60),
      swiftCode: text(30),
      bankBranch: text(200),
      productionTime: text(120),
      paymentTerms: text(160),
      shipmentTerms: text(120),
      shipmentMode: text(60),
      portOfLoading: text(120),
      countryOfOrigin: text(60),
    }),
    fallback: () => ({ ...COMPANY }),
  },
  "production.checkpoints": {
    label: "Production check points",
    schema: z.object({ stages: z.record(z.string(), z.array(checkpointSchema).max(30)) })
      .superRefine((value, context) => {
        for (const [stageKey, points] of Object.entries(value.stages)) {
          if (!CHECKED_STAGES.includes(stageKey)) context.addIssue({ code: "custom", path: ["stages", stageKey], message: "Check points apply to stages 1–6 only." });
          const keys = points.map((point) => point.key);
          if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: ["stages", stageKey], message: "Each check point needs its own key." });
        }
      }),
    fallback: () => ({ stages: DEFAULT_CHECKPOINTS }),
  },
  "planning.weeklyOff": {
    label: "Weekly off days",
    schema: z.object({ days: z.array(z.number().int().min(0).max(6)).max(6).transform((days) => [...new Set(days)].sort()) }),
    fallback: () => ({ days: [0] }),
  },
} as const;
export type SettingKey = keyof typeof SETTINGS;

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, key);
}

export async function getSetting<K extends SettingKey>(key: K): Promise<z.infer<(typeof SETTINGS)[K]["schema"]> & { configured: boolean }> {
  const row = await db.orm.public.AppSetting.where({ key }).first();
  if (!row) return { ...(SETTINGS[key].fallback() as object), configured: false } as never;
  const parsed = SETTINGS[key].schema.safeParse(JSON.parse(row.value));
  if (!parsed.success) throw new AppError(`Stored setting ${key} is invalid; save it again.`, { code: "SETTING_INVALID", status: 500 });
  return { ...(parsed.data as object), configured: true } as never;
}

export async function setSetting(key: string, value: unknown, actorId: string) {
  if (!isSettingKey(key)) throw new AppError("Unknown setting.", { code: "SETTING_NOT_FOUND", status: 404 });
  const parsed = SETTINGS[key].schema.safeParse(value);
  if (!parsed.success) throw new AppError("Setting validation failed.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
  const json = JSON.stringify(parsed.data);
  await db.runtime().query(db.raw.sql`
    insert into erp_app_settings (key, value, "updatedBy", "updatedAt") values (${key}, ${json}, ${actorId}::uuid, now())
    on conflict (key) do update set value = excluded.value, "updatedBy" = excluded."updatedBy", "updatedAt" = now()
    returning key
  `.returnsRow({ key: "pg/text@1" }).build() as never);
  await recordAuditEvent({ actorId, action: "SETTING_UPDATED", entityType: "AppSetting", entityId: null, metadata: { key } });
  return getSetting(key);
}

export async function listSettings() {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(SETTINGS) as SettingKey[]) out[key] = { label: SETTINGS[key].label, value: await getSetting(key) };
  return out;
}
