export interface AppErrorOptions {
  code: string;
  status: number;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );

    if (
      !Number.isInteger(options.status) ||
      options.status < 400 ||
      options.status > 599
    ) {
      throw new RangeError("AppError status must be an HTTP error status.");
    }

    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}
