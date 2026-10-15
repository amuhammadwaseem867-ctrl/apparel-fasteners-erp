/*
 * Failed-login rate limiting.
 *
 * Failures are counted per email (stops guessing one account's password)
 * and per client IP (stops one client trying many accounts). The store is
 * in process memory and bounded in size, so a flood of distinct emails or
 * IPs cannot grow it without limit. Login uses the database-backed
 * limiter in login-rate-limit.db.ts (shared by all instances, D-025); this
 * in-memory version defines the policy defaults and is kept for unit tests.
 *
 * This module has no imports so it can be tested directly.
 */

export interface LoginRateLimitOptions {
  windowMs: number;
  maxFailuresPerEmail: number;
  maxFailuresPerIp: number;
  maxEntries: number;
  now?: () => number;
}

interface FailureEntry {
  count: number;
  firstFailureAt: number;
}

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  maxFailuresPerEmail: 5,
  maxFailuresPerIp: 20,
  maxEntries: 10_000,
};

export function createLoginRateLimiter(
  options: LoginRateLimitOptions = DEFAULT_LOGIN_RATE_LIMIT,
) {
  const entries = new Map<string, FailureEntry>();
  const now = options.now ?? Date.now;

  function keysFor(email: string, ip?: string | null) {
    const keys: Array<{ key: string; limit: number }> = [
      { key: `email:${email}`, limit: options.maxFailuresPerEmail },
    ];

    if (ip) {
      keys.push({ key: `ip:${ip}`, limit: options.maxFailuresPerIp });
    }

    return keys;
  }

  function activeEntry(key: string): FailureEntry | null {
    const entry = entries.get(key);

    if (!entry) {
      return null;
    }

    if (now() - entry.firstFailureAt >= options.windowMs) {
      entries.delete(key);
      return null;
    }

    return entry;
  }

  function evictIfFull() {
    if (entries.size < options.maxEntries) {
      return;
    }

    for (const key of [...entries.keys()]) {
      activeEntry(key);
    }

    // Map iteration is insertion order, so the first key is the oldest.
    while (entries.size >= options.maxEntries) {
      const oldest = entries.keys().next().value;

      if (oldest === undefined) {
        break;
      }

      entries.delete(oldest);
    }
  }

  return {
    isLimited(email: string, ip?: string | null): boolean {
      return keysFor(email, ip).some(({ key, limit }) => {
        const entry = activeEntry(key);
        return entry !== null && entry.count >= limit;
      });
    },

    registerFailure(email: string, ip?: string | null): boolean {
      let limited = false;

      for (const { key, limit } of keysFor(email, ip)) {
        const entry = activeEntry(key);

        if (entry) {
          entry.count += 1;
          limited ||= entry.count >= limit;
        } else {
          evictIfFull();
          entries.set(key, { count: 1, firstFailureAt: now() });
          limited ||= limit <= 1;
        }
      }

      return limited;
    },

    /*
     * A successful login clears the account's counter only. The IP
     * counter keeps running so a valid login cannot reset an attacker's
     * budget for other accounts.
     */
    registerSuccess(email: string): void {
      entries.delete(`email:${email}`);
    },

    size(): number {
      return entries.size;
    },
  };
}
