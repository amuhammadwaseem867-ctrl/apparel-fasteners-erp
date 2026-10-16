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
    }),
    fallback: () => ({ ...COMPANY }),
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
