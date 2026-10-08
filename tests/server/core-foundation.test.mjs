import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseUrl } from "../../server/core/database/database-url.ts";
import { AppError } from "../../server/core/errors/app-error.ts";
import { logger } from "../../server/core/logger/logger.ts";
import { failureResponse, successResponse } from "../../server/core/response/api-response.ts";
import { resolveRequestId } from "../../server/core/utils/request-id.ts";

test("database URL validation accepts PostgreSQL URLs and rejects unsafe values", () => {
  const url = "postgresql://erp-user:secret@db.example:5432/erp?sslmode=require";
  assert.equal(getDatabaseUrl({ DATABASE_URL: url }), url);
  assert.throws(
    () => getDatabaseUrl({ DATABASE_URL: "https://db.example/erp" }),
    { name: "ConfigurationError", message: /valid PostgreSQL/ },
  );
  assert.throws(
    () => getDatabaseUrl({}),
    { name: "ConfigurationError", message: /must be configured/ },
  );
});

test("API response helpers preserve the established success and error envelopes", () => {
  assert.deepEqual(successResponse({ id: "item-1" }), {
    success: true,
    data: { id: "item-1" },
    meta: {},
  });
  assert.deepEqual(failureResponse("INVALID", "Invalid request", { field: "sku" }), {
    success: false,
    error: {
      code: "INVALID",
      message: "Invalid request",
      details: { field: "sku" },
    },
  });
});

test("application errors retain safe status, code, and causal information", () => {
  const cause = new Error("internal database detail");
  const error = new AppError("Record not found", {
    code: "NOT_FOUND",
    status: 404,
    cause,
  });
  assert.equal(error.status, 404);
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.message, "Record not found");
  assert.equal(error.cause, cause);
  assert.throws(
    () => new AppError("Invalid status", { code: "INVALID", status: 200 }),
    RangeError,
  );
});

test("logger redacts secret fields and connection strings", () => {
  const originalLog = console.log;
  let line = "";
  console.log = (value) => {
    line = value;
  };
  try {
    logger.info("Database operation", {
      password: "sensitive",
      detail: "postgres://user:secret@db.example/app",
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(line.includes("sensitive"), false);
  assert.equal(line.includes("db.example"), false);
  assert.equal(line.includes("[REDACTED]"), true);
});

test("request identifiers accept bounded safe values and replace invalid values", () => {
  assert.equal(resolveRequestId("req-123"), "req-123");
  assert.match(resolveRequestId("contains spaces"), /^[0-9a-f-]{36}$/);
  assert.match(resolveRequestId("x".repeat(129)), /^[0-9a-f-]{36}$/);
});
