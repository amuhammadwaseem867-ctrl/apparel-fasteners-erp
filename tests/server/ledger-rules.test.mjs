import assert from "node:assert/strict";
import test from "node:test";

import { entryProblem, entryTotal, nonZero, normalBalance, reverseLines } from "../../server/ledger/ledger-rules.ts";

test("balanced entries in whole cents are accepted; anything else is refused with a reason", () => {
  assert.equal(entryProblem([{ debit: "100.10", credit: "0" }, { debit: "0", credit: "60.05" }, { debit: "0", credit: "40.05" }]), null);
  assert.match(entryProblem([{ debit: "100", credit: "0" }]), /at least two/);
  assert.match(entryProblem([{ debit: "100", credit: "0" }, { debit: "0", credit: "99.99" }]), /must equal/);
  assert.match(entryProblem([{ debit: "1", credit: "1" }, { debit: "0", credit: "0" }]), /either a debit or a credit/);
  assert.match(entryProblem([{ debit: "0.005", credit: "0" }, { debit: "0", credit: "0.005" }]), /whole cents/);
  assert.match(entryProblem([{ debit: "-5", credit: "0" }, { debit: "0", credit: "-5" }]), /negative|either/);
  assert.equal(entryProblem([{ debit: "0.10", credit: "0" }, { debit: "0", credit: "0.1" }]), null, "0.10 and 0.1 are the same amount");
});

test("totals, reversals and normal balances are exact", () => {
  const lines = [{ debit: "123456789012.34", credit: "0" }, { debit: "0", credit: "123456789012.34" }];
  assert.equal(entryTotal(lines), "123456789012.34");
  assert.deepEqual(reverseLines(lines), [{ debit: "0", credit: "123456789012.34" }, { debit: "123456789012.34", credit: "0" }]);
  assert.equal(normalBalance("ASSET", "100.00", "30.01"), "69.99");
  assert.equal(normalBalance("LIABILITY", "100.00", "30.01"), "-69.99");
  assert.equal(normalBalance("INCOME", "0", "0.30"), "0.30");
  assert.equal(normalBalance("EXPENSE", "0.1", "0.2"), "-0.10");
  assert.deepEqual(nonZero([{ debit: "0.00", credit: "0" }, { debit: "1", credit: "0" }]), [{ debit: "1", credit: "0" }]);
});
