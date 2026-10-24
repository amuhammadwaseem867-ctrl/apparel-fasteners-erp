/*
 * Request bodies that name their location by hand (D-046, D-048): a typed
 * "locationName" instead of a "locationId". The rest of the body is checked
 * first, with a stand-in location, so a request that would be refused never
 * creates a location; then the typed name is found or created in the
 * warehouse and the body is checked again with the real id.
 */

import { AppError } from "../core/errors/app-error";
import { resolveTypedLocation } from "./inventory.service";

type Schema<T> = { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } } };

const STAND_IN = "00000000-0000-4000-8000-000000000001";

function check<T>(schema: Schema<T>, body: Record<string, unknown>): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("Request validation failed.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
  }
  return parsed.data;
}

export async function parseBodyWithTypedLocation<T>(request: Request, schema: Schema<T>, actorId: string): Promise<T> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (cause) {
    throw new AppError("Request body must be valid JSON.", { code: "INVALID_JSON", status: 400, cause });
  }
  const { locationName, ...rest } = body ?? {};
  const name = typeof locationName === "string" ? locationName.trim().slice(0, 60) : "";
  // A body with neither an id nor a usable name has no location at all: say so
  // plainly instead of a generic schema failure on "locationId".
  if (!rest.locationId && !name) {
    check(schema, rest);
    throw new AppError("Choose or type a location.", { code: "LOCATION_REQUIRED", status: 400 });
  }
  if (rest.locationId || !name) return check(schema, rest);
  check(schema, { ...rest, locationId: STAND_IN });
  return check(schema, { ...rest, locationId: await resolveTypedLocation(name, actorId) });
}
