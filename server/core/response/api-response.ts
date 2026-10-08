export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: Readonly<Record<string, unknown>>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function successResponse<T>(
  data: T,
  meta: Readonly<Record<string, unknown>> = {},
): ApiSuccess<T> {
  return { success: true, data, meta };
}

export function failureResponse(
  code: string,
  message: string,
  details?: unknown,
): ApiFailure {
  return {
    success: false,
    error:
      details === undefined ? { code, message } : { code, message, details },
  };
}
