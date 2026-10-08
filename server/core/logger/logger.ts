export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogField = string | number | boolean | null;
export type LogFields = Readonly<Record<string, LogField>>;

const sensitiveField =
  /password|secret|token|authorization|cookie|database.?url|connection.?string|api.?key/i;
const sensitiveText =
  /\b(?:postgres(?:ql)?:\/\/[^\s"'<>]+|(?:password|secret|token|authorization|database_url|connection_string|api[_-]?key)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s,;]+))/gi;

function sanitize(value: string): string {
  return value.replace(sensitiveText, "[REDACTED]");
}

function write(
  level: LogLevel,
  message: string,
  fields: LogFields = {},
): void {
  const safeFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      sensitiveField.test(key)
        ? "[REDACTED]"
        : typeof value === "string"
          ? sanitize(value)
          : value,
    ]),
  );

  const line = JSON.stringify({
    ...safeFields,
    timestamp: new Date().toISOString(),
    level,
    message: sanitize(message),
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) =>
    write("debug", message, fields),
  info: (message: string, fields?: LogFields) =>
    write("info", message, fields),
  warn: (message: string, fields?: LogFields) =>
    write("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    write("error", message, fields),
};
