import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { csvField, toCsv } from "../../server/core/utils/csv.ts";

test("CSV fields are quoted per RFC 4180", () => {
  assert.equal(csvField("plain"), "plain");
  assert.equal(csvField("a,b"), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField("two\nlines"), '"two\nlines"');
  assert.equal(csvField(null), "");
  assert.equal(csvField(undefined), "");
  assert.equal(csvField(1250.5), "1250.5");
  assert.equal(csvField(Number.NaN), "");
});

test("spreadsheet formulas in text cannot execute when the file is opened", () => {
  assert.equal(csvField("=HYPERLINK(\"http://x\")"), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(csvField("+1+1"), "'+1+1");
  assert.equal(csvField("-2"), "'-2");
  assert.equal(csvField("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvField(-2), "-2", "real numbers are not altered");
});

test("documents start with a UTF-8 BOM and use CRLF line endings", () => {
  const csv = toCsv(["Order", "Customer"], [["SO-1", "Café, Ltd"]]);

  assert.equal(csv, '﻿Order,Customer\r\nSO-1,"Café, Ltd"\r\n');
});

test("the export route enforces sales:view, validates filters and audits each export", () => {
  const source = readFileSync(
    join(import.meta.dirname, "../../app/api/sales/orders/export/route.js"),
    "utf8",
  );

  assert.match(source, /authorizeRequest\(request, "sales:view"\)/);
  assert.match(source, /salesOrderQuerySchema\.safeParse/);
  assert.match(source, /action: "SALES_ORDERS_EXPORTED"/);
  assert.match(source, /"Cache-Control": "no-store"/);
});
