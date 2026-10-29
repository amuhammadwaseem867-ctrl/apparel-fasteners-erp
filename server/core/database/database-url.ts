export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/*
 * The database the app uses (D-054): Neon's connection when Vercel's Neon
 * store is connected to the project with the "neon_" prefix, else
 * DATABASE_URL. So switching to Neon needs no copying of passwords between
 * settings; disconnecting the Neon store falls back to DATABASE_URL.
 */
export function getDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const value = (env.neon_DATABASE_URL?.trim() || env.DATABASE_URL)?.trim();

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
