/*
 * Deterministic SKU suggestion from an item's specification.
 *
 * The same specification always yields the same code, so a SKU is never
 * regenerated on render. Uniqueness is guaranteed by the database (unique
 * SKU constraint); a duplicate is rejected on save, never overwritten.
 *
 * Example: Sliders, #5, DA, Antique Silver, Plain -> SLI-5-DA-ANSI-PL
 */

function segment(value, length = 4) {
  if (!value) {
    return "";
  }

  const text = String(value).toUpperCase().replace(/#/g, "").trim();
  const words = text.split(/[^A-Z0-9.]+/).filter(Boolean);

  if (!words.length) {
    return "";
  }

  // Sizes and numeric codes are kept whole: "4.5" -> "45", "620" -> "620".
  if (/^[0-9.]+$/.test(words[0]) && words.length === 1) {
    return words[0].replace(".", "");
  }

  if (words.length === 1) {
    return words[0].replace(".", "").slice(0, length);
  }

  // Multi-word values: first two letters of the first two words, plus any
  // numeric word ("620 SS" -> "620SS", "Antique Silver" -> "ANSI").
  return words
    .map((word) => (/^[0-9.]+$/.test(word) ? word.replace(".", "") : word.slice(0, 2)))
    .join("")
    .slice(0, Math.max(length, 6));
}

const LOGO_CODES = { logo: "LG", plain: "PL", standard: "ST" };

export function suggestSku({ category, size, itemType, material, finish, color, logoType, variant }) {
  // A type that only repeats the category ("Pin Box" in Pin Box) adds nothing.
  const singular = (value) => String(value).trim().toLowerCase().replace(/s$/, "");
  const sameAsCategory = itemType && category && singular(itemType) === singular(category);

  const parts = [
    segment(category, 3),
    segment(size),
    sameAsCategory ? "" : segment(itemType),
    segment(material),
    segment(finish),
    segment(color),
    segment(variant),
    logoType ? LOGO_CODES[String(logoType).toLowerCase()] ?? segment(logoType, 2) : "",
  ].filter(Boolean);

  return parts.join("-");
}
