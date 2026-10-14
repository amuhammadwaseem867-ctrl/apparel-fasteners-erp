/*
 * Shared display formatters.
 *
 * Money amounts (totals) show exactly two decimals. Unit prices are stored
 * with up to six decimals (D-012), so they show at least two and up to six,
 * never rounding away a sub-cent price.
 */

export function formatAmount(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : "—";
}

export function formatUnitPrice(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
    : "—";
}

export function formatQuantity(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-US", { maximumFractionDigits: 4 })
    : "—";
}
