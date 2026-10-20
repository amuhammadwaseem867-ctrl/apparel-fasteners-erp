/*
 * AF7 order numbers (D-048): AF7-<two-digit year>-<serial>, e.g.
 * AF7-26-0001. The serial is one running count that never restarts: only
 * the year part follows the order date, so after AF7-26-0154 a 2027 order
 * is AF7-27-0155. One number follows the order everywhere: its invoice,
 * production, packing, dispatch and every printed document.
 */

export const ORDER_PREFIX = "AF7";

/* The one running counter behind every order number. */
export const ORDER_SEQUENCE_KEY = `${ORDER_PREFIX}-ORDER`;

export function formatOrderNumber(isoDate, serial) {
  const year = String(isoDate).slice(2, 4);
  return `${ORDER_PREFIX}-${year}-${String(serial).padStart(4, "0")}`;
}
