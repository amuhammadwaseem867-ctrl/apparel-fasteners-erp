/*
 * AF7 rule: a #4.5 zipper is always made with Y-Cut teeth. Shared by the
 * order sheet form (sets the type) and its server validation (enforces it).
 */

export const Y_CUT = "Y-Cut";

/* True when the product text names a #4.5 zipper ("#4.5 Metal Zipper", "4.5 Brass ..."). */
export function isSize45(product) {
  return /(^|[^0-9.])4\.5(?![0-9])/.test(String(product ?? ""));
}
