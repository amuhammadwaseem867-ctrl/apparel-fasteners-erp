import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_ALGORITHM = "scrypt";
const KEY_LENGTH_BYTES = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
};

export function hashPassword(password: string): string {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password is required.");
  }

  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(
    password,
    salt,
    KEY_LENGTH_BYTES,
    SCRYPT_OPTIONS,
  );

  return `${HASH_ALGORITHM}:${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(
  password: string,
  storedHash: string,
): boolean {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    typeof storedHash !== "string" ||
    storedHash.length === 0
  ) {
    return false;
  }

  const parts = storedHash.split(":");

  if (parts.length !== 3) {
    return false;
  }

  const [algorithm, salt, expectedHash] = parts;

  if (
    algorithm !== HASH_ALGORITHM ||
    !salt ||
    !expectedHash ||
    !/^[0-9a-f]+$/i.test(expectedHash)
  ) {
    return false;
  }

  try {
    const derived = scryptSync(
      password,
      salt,
      KEY_LENGTH_BYTES,
      SCRYPT_OPTIONS,
    );

    const expected = Buffer.from(expectedHash, "hex");

    if (derived.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}