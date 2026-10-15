import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { getModuleAvailability } from "../../config/moduleAvailability.js";
import {
  BackendUnavailableError,
  backendUnavailableReason,
  unavailableAction,
} from "../../lib/backendUnavailable.js";

const root = join(import.meta.dirname, "../..");

test("routes without a backend get a banner; connected routes do not", () => {
  for (const path of ["/dashboard", "/products", "/products/abc", "/sales/orders", "/sales/customers", "/administration/profile", "/inventory/stock"]) {
    assert.equal(getModuleAvailability(path), null, path);
  }

  assert.equal(getModuleAvailability("/quality/ncr")?.label, "Non-conformance reports");
  assert.equal(getModuleAvailability("/finance/expenses")?.label, "Expenses");
  for (const path of ["/quality", "/quality/final", "/packing/orders", "/dispatch/shipments", "/finance", "/finance/invoices", "/finance/receivables"]) {
    assert.equal(getModuleAvailability(path), null, `${path} is connected`);
  }
  assert.equal(getModuleAvailability("/people-payroll/payroll")?.label, "People and payroll");
  assert.equal(getModuleAvailability("/products/bom"), null, "BOM authoring is connected");
  assert.equal(getModuleAvailability("/planning/mrp-runs"), null, "MRP is connected");
  assert.equal(getModuleAvailability("/production/orders"), null, "production is connected");
  assert.equal(getModuleAvailability("/planning/production-plans")?.label, "Production plans");
  assert.equal(getModuleAvailability("/planning/capacity")?.label, "Capacity planning");
  assert.equal(getModuleAvailability("/administration/users")?.label, "Administration");
  assert.match(getModuleAvailability("/reports/orders")?.message, /Dashboard and Sales pages/);
  assert.equal(getModuleAvailability("/productionx"), null, "prefix must match a whole path segment");
  assert.equal(getModuleAvailability(null), null);
});

test("unavailable actions throw a typed error instead of pretending to save", () => {
  const action = unavailableAction("Quality control", "createNcr");

  assert.throws(action, (error) =>
    error instanceof BackendUnavailableError &&
    error.code === "BACKEND_UNAVAILABLE" &&
    error.action === "createNcr" &&
    /cannot be saved yet/.test(error.message));

  assert.match(backendUnavailableReason("Finance"), /^Not available yet: the Finance/);
});

test("client stores and the finance workspace never keep business records in browser state", () => {
  const files = [
    ...readdirSync(join(root, "lib"))
      .filter((file) => /^use.*Store\.js$/.test(file))
      .map((file) => join(root, "lib", file)),
    join(root, "components/finance/FinanceWorkspace.jsx"),
  ];

  assert.ok(files.length >= 5);

  for (const file of files) {
    const source = readFileSync(file, "utf8");

    // A record list held in React state with a setter is browser-only persistence.
    assert.doesNotMatch(source, /const \[\w+, set\w+\] = useState\((\[\]|initial\w*)\)/, `${file} keeps a mutable record list in browser state`);
    assert.doesNotMatch(source, /\bset(Records|Transactions)\b/, `${file} mutates records in browser state`);
    assert.doesNotMatch(source, /toast\.success/, `${file} reports success without a server`);
    assert.doesNotMatch(source, /setTimeout\(resolve/, `${file} simulates a server delay`);
  }
});

test("production and planning pages do not simulate refreshes", () => {
  for (const area of ["production", "planning"]) {
    const dir = join(root, "app/(erp)", area);

    for (const file of readdirSync(dir, { recursive: true }).filter((name) => String(name).endsWith(".jsx"))) {
      const source = readFileSync(join(dir, String(file)), "utf8");
      assert.doesNotMatch(source, /setTimeout\(resolve/, `${area}/${file} simulates a server delay`);
    }
  }
});
