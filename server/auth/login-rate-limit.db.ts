/*
 * Failed-login rate limiting shared by every server instance (D-025).
 *
 * Same policy as login-rate-limit.ts (per email and per client IP, fixed
 * window), but counters live in erp_login_attempt_counters and each update
 * is one atomic upsert, so concurrent attempts on any number of instances
 * are all counted and the limit survives restarts. Keys are SHA-256 hashes;
 * raw emails and IP addresses are not stored.
 */

import { createHash } from "node:crypto";

import { db } from "../core/database/client";
import { DEFAULT_LOGIN_RATE_LIMIT, type LoginRateLimitOptions } from "./login-rate-limit";

type Runner = ReturnType<typeof db.runtime>;

function hashKey(kind: "email" | "ip", value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

export function createDatabaseLoginRateLimiter(
  options: Pick<LoginRateLimitOptions, "windowMs" | "maxFailuresPerEmail" | "maxFailuresPerIp"> = DEFAULT_LOGIN_RATE_LIMIT,
  runner: () => Runner = () => db.runtime(),
) {
  const windowSeconds = String(Math.ceil(options.windowMs / 1000));

  function keysFor(email: string, ip?: string | null) {
    const keys = [{ key: hashKey("email", email), limit: options.maxFailuresPerEmail }];
    if (ip) keys.push({ key: hashKey("ip", ip), limit: options.maxFailuresPerIp });
    return keys;
  }

  async function query<T>(plan: unknown) {
    return (await runner().query(plan as never)) as unknown as T[];
  }

  return {
    async isLimited(email: string, ip?: string | null): Promise<boolean> {
      for (const { key, limit } of keysFor(email, ip)) {
        const rows = await query<{ count: string }>(db.raw.sql`
          select count::text as count from erp_login_attempt_counters
          where key = ${key} and "windowStart" > now() - (${windowSeconds} || ' seconds')::interval
        `.returnsRow({ count: "pg/text@1" }).build());
        if (rows.length && Number(rows[0].count) >= limit) return true;
      }
      return false;
    },

    /* Counts one failure for the email and IP; returns true when either is now limited. */
    async registerFailure(email: string, ip?: string | null): Promise<boolean> {
      let limited = false;
      for (const { key, limit } of keysFor(email, ip)) {
        const [row] = await query<{ count: string }>(db.raw.sql`
          insert into erp_login_attempt_counters (key, count, "windowStart", "updatedAt")
          values (${key}, 1, now(), now())
          on conflict (key) do update set
            count = case when erp_login_attempt_counters."windowStart" <= now() - (${windowSeconds} || ' seconds')::interval
              then 1 else erp_login_attempt_counters.count + 1 end,
            "windowStart" = case when erp_login_attempt_counters."windowStart" <= now() - (${windowSeconds} || ' seconds')::interval
              then now() else erp_login_attempt_counters."windowStart" end,
            "updatedAt" = now()
          returning count::text as count
        `.returnsRow({ count: "pg/text@1" }).build());
        limited ||= Number(row.count) >= limit;
      }
      // Housekeeping: drop expired counters so the table stays small.
      await query(db.raw.sql`
        delete from erp_login_attempt_counters
        where "windowStart" <= now() - (${windowSeconds} || ' seconds')::interval
        returning key
      `.returnsRow({ key: "pg/text@1" }).build());
      return limited;
    },

    /* A successful login clears the account's counter only (not the IP's). */
    async registerSuccess(email: string): Promise<void> {
      await query(db.raw.sql`delete from erp_login_attempt_counters where key = ${hashKey("email", email)} returning key`
        .returnsRow({ key: "pg/text@1" }).build());
    },
  };
}
