import { AppError } from "./app-error";
import { DATABASE_SCHEMA_OUTDATED, getSchemaMismatch } from "./database-errors";
import { logger } from "../logger/logger";
import { failureResponse, type ApiFailure } from "../response/api-response";

export interface HandledError {
  status: number;
  body: ApiFailure;
}

export function handleApiError(
  error: unknown,
  requestId?: string,
): HandledError {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: failureResponse(error.code, error.message, error.details),
    };
  }

  const schemaMismatch = getSchemaMismatch(error);

  if (schemaMismatch) {
    logger.error("Database schema is behind the application contract", {
      requestId: requestId ?? null,
      sqlState: schemaMismatch.sqlState ?? null,
      table: schemaMismatch.table ?? null,
      column: schemaMismatch.column ?? null,
    });

    return {
      status: DATABASE_SCHEMA_OUTDATED.status,
      body: failureResponse(
        DATABASE_SCHEMA_OUTDATED.code,
        DATABASE_SCHEMA_OUTDATED.message,
      ),
    };
  }

  logger.error("Unhandled server error", {
    requestId: requestId ?? null,
    errorName: error instanceof Error ? error.name : "NonErrorThrown",
    errorStack: error instanceof Error ? error.stack ?? error.message : "",
  });

  return {
    status: 500,
    body: failureResponse(
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred.",
    ),
  };
}
