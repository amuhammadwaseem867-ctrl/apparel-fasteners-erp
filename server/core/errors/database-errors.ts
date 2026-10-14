/*
 * Classification of database driver errors.
 *
 * Prisma 8 surfaces failed SQL statements as SqlQueryError
 * (kind "sql_query") with a normalized SQLSTATE. This module has no
 * imports so it can be used by the error handler and tested directly.
 */

/*
 * PostgreSQL SQLSTATEs raised when the application queries a table or
 * column that the connected database does not have yet, i.e. a contract
 * migration has not been applied to that database.
 */
const SCHEMA_MISMATCH_SQLSTATES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
]);

export const DATABASE_SCHEMA_OUTDATED = {
  code: "DATABASE_SCHEMA_OUTDATED",
  status: 503,
  message:
    "This action needs database changes that have not been applied yet. Ask an administrator to apply the pending database migration, then try again.",
} as const;

export interface SqlQueryErrorLike {
  kind: "sql_query";
  sqlState?: string;
  table?: string;
  column?: string;
}

export function findSqlQueryError(error: unknown): SqlQueryErrorLike | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      typeof current === "object" &&
      (current as { kind?: unknown }).kind === "sql_query"
    ) {
      return current as SqlQueryErrorLike;
    }

    current = current instanceof Error ? current.cause : undefined;
  }

  return null;
}

export function getSchemaMismatch(error: unknown): SqlQueryErrorLike | null {
  const sqlError = findSqlQueryError(error);

  return sqlError?.sqlState &&
    SCHEMA_MISMATCH_SQLSTATES.has(sqlError.sqlState)
    ? sqlError
    : null;
}
