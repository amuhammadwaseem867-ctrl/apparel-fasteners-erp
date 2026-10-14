/*
 * Guard for modules that have no server API or database tables yet.
 *
 * Client stores for these modules used to keep records in browser memory
 * and report success, so data was lost on reload and never reached the
 * server. Their mutations now throw BackendUnavailableError instead, so a
 * record can never appear saved when it is not.
 */

export class BackendUnavailableError extends Error {
  constructor(moduleLabel, action) {
    super(
      `${moduleLabel} cannot be saved yet: its database tables and API have not been set up.`,
    );

    this.name = "BackendUnavailableError";
    this.code = "BACKEND_UNAVAILABLE";
    this.module = moduleLabel;
    this.action = action;
  }
}

export function unavailableAction(moduleLabel, action) {
  return function unavailable() {
    throw new BackendUnavailableError(moduleLabel, action);
  };
}

export function backendUnavailableReason(moduleLabel) {
  return `Not available yet: the ${moduleLabel} database tables and API have not been set up.`;
}
