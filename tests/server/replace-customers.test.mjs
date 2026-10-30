/*
 * D-057: the import file is checked before anything is changed: every
 * customer's lines must add up to its closing balance, and a khata not in
 * PKR is added without its lines.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { readImport, replaceSql } from "../../scripts/replace-customers.mjs";

const entry = (date, debit, credit, extra = {}) => ({ date, debit, credit, reference: "", poNumber: "", dcNumber: "", description: "Metal Zipper", ...extra });

test("customers get codes in file order and their balances", () => {
  const customers = readImport({ customers: [
    { name: "HOPSCOTCH", openingBalance: "0", closingBalance: "3211.00", entries: [entry("2025-11-18", "367204", "0"), entry("2026-07-30", "0", "363993")] },
    { name: "Burraq Garments (2)", openingBalance: "196877.00", closingBalance: "196877.00", entries: [] },
    { name: "Hassan Sb", currency: "USD", openingBalance: "0", closingBalance: "100.00", entries: [entry("2026-03-03", "100", "0")] },
  ] });
  assert.deepEqual(customers.map((customer) => [customer.code, customer.balance]), [["CUS-001", 321100n], ["CUS-002", 19687700n], ["CUS-003", 0n]]);
  assert.equal(customers[2].skippedLines, 1, "a USD khata is not mixed into PKR");
  const sql = replaceSql(customers, "2026-10-30").join(";\n");
  assert.match(sql, /'CustomerOpening', '[0-9a-f-]{36}', 'IMPORT'/);
  assert.equal((sql.match(/insert into erp_journal_entries/g) ?? []).length, 2, "one accounting entry per PKR customer that owes something");
});

test("a file whose lines do not add up, or with a bad date or amount, is refused", () => {
  assert.throws(() => readImport({ customers: [{ name: "A", openingBalance: "0", closingBalance: "10.00", entries: [entry("2026-01-01", "9", "0")] }] }), /add up to 9.00, the file says 10.00/);
  assert.throws(() => readImport({ customers: [{ name: "A", openingBalance: "0", entries: [entry("1/1/2026", "9", "0")] }] }), /not YYYY-MM-DD/);
  assert.throws(() => readImport({ customers: [{ name: "A", openingBalance: "0", entries: [entry("2026-01-01", "-9", "0")] }] }), /debit -9 is not an amount/);
  assert.throws(() => readImport({ customers: [{ name: "A", openingBalance: "0", entries: [] }, { name: "a", openingBalance: "0", entries: [] }] }), /appears twice/);
  assert.throws(() => readImport({ customers: [] }), /no customers/);
});

test("quotes in names and descriptions cannot break the SQL", () => {
  const [customer] = readImport({ customers: [{ name: "Sheikh's", openingBalance: "0", entries: [entry("2026-01-01", "5", "0", { description: "it's" })] }] });
  const sql = replaceSql([customer], "2026-10-30").join("\n");
  assert.match(sql, /'Sheikh''s'/);
  assert.match(sql, /'it''s'/);
});
