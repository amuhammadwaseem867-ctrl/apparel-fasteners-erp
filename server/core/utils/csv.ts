/*
 * CSV generation for exports (RFC 4180).
 *
 * - Fields containing a comma, quote, CR or LF are quoted; quotes doubled.
 * - Text that a spreadsheet would treat as a formula (leading =, +, -, @,
 *   tab or CR) is prefixed with an apostrophe, so an exported customer name
 *   such as "=HYPERLINK(...)" cannot execute when the file is opened.
 *   Numbers are written as-is.
 * - A UTF-8 byte order mark lets Excel detect the encoding.
 */

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  let text = String(value);

  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(","));

  return `﻿${lines.join("\r\n")}\r\n`;
}
