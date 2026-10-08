export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function getDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env.DATABASE_URL?.trim();

  if (!value) {
    throw new ConfigurationError("DATABASE_URL must be configured.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigurationError(
      "DATABASE_URL must be a valid PostgreSQL connection URL.",
    );
  }

  if (
    (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
    !parsed.hostname
  ) {
    throw new ConfigurationError(
      "DATABASE_URL must be a valid PostgreSQL connection URL.",
    );
  }

  return value;
}
