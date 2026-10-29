/*
 * Loads DATABASE_URL (and other keys) from .env.local, then .env, when they
 * are not already set, like the Prisma CLI does. No dependencies, works on
 * any Node 20+ (Windows included).
 *
 * Windows PowerShell's `echo X=Y >> .env.local` appends UTF-16 text to a
 * UTF-8 file; such lines are read too (the zero bytes and byte-order marks
 * are dropped), so a value added that way is not silently missed.
 */

import { existsSync, readFileSync } from "node:fs";

/* The file's text, whether saved as UTF-8, UTF-16, or a mix of both. */
export function envText(buffer) {
  const utf16 = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const text = utf16 ? buffer.subarray(2).toString("utf16le") : buffer.toString("utf8");
  return text.replace(/[\u0000﻿�]/g, "");
}

export const ENV_FILES = [".env.local", ".env"];

export function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || values.has(match[1])) continue;
    let value = match[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    values.set(match[1], value);
  }
  return values;
}

for (const file of ENV_FILES) {
  if (!existsSync(file)) continue;
  for (const [key, value] of parseEnv(envText(readFileSync(file)))) {
    if (!(key in process.env)) process.env[key] = value;
  }
}
