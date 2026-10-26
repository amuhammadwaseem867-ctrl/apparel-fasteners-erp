/*
 * Request bodies that name their location by hand (D-046, D-048): a typed
 * "locationName" instead of a "locationId". The rest of the body is checked
 * first, with a stand-in location, so a request that would be refused never
 * creates a location; then the typed name is found or created in the
 * warehouse and the body is checked again with the real id.
 *
 * The location is never required (D-053): with neither an id nor a name,
 * `fallback` picks one (e.g. where the item's stock is), else "General";
 * a fallback returning "" says the body needs none.
 */

import { AppError } from "../core/errors/app-error";
import { DEFAULT_LOCATION_NAME, resolveTypedLocation } from "./inventory.service";

type Schema<T> = { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } } };

const STAND_IN = "00000000-0000-4000-8000-000000000001";

function check<T>(schema: Schema<T>, body: Record<string, unknown>): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("Request validation failed.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
  }
  return parsed.data;
}

export async function parseBodyWithTypedLocation<T>(
  request: Request,
  schema: Schema<T>,
  actorId: string,
  fallback?: (body: Record<string, unknown>) => Promise<string | null>,
): Promise<T> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (cause) {
    throw new AppError("Request body must be valid JSON.", { code: "INVALID_JSON", status: 400, cause });
  }
  const { locationName, ...rest } = body ?? {};
  const name = typeof locationName === "string" ? locationName.trim().slice(0, 60) : "";
  if (!rest.locationId && !name) {
    // A fallback answering "" means this body needs no location at all.
    const picked = fallback ? await fallback(rest) : null;
    if (picked === "") return check(schema, rest);
    check(schema, { ...rest, locationId: STAND_IN });
    return check(schema, { ...rest, locationId: picked ?? await resolveTypedLocation(DEFAULT_LOCATION_NAME, actorId) });
  }
  if (rest.locationId || !name) return check(schema, rest);
  check(schema, { ...rest, locationId: STAND_IN });
  return check(schema, { ...rest, locationId: await resolveTypedLocation(name, actorId) });
}
