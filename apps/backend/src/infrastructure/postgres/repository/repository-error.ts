export class RepositoryError extends Error {
  readonly code: string;
  readonly prismaCode?: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.cause = cause;

    if (
      cause !== null &&
      typeof cause === 'object' &&
      'code' in cause &&
      typeof cause.code === 'string' &&
      (cause as { code: string }).code.startsWith('P')
    ) {
      this.prismaCode = (cause as { code: string }).code;
    }
  }
}

export class UniqueConstraintError extends RepositoryError {
  constructor(code: string, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'UniqueConstraintError';
    (this as { prismaCode?: string }).prismaCode = 'P2002';
  }
}
