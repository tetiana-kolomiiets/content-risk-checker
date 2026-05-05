// Duck-typed against Prisma's PrismaClientKnownRequestError to avoid importing
// Prisma outside of *.repository.ts files (see project conventions). P2002 is
// the documented code for unique-constraint violations.
const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === PRISMA_UNIQUE_CONSTRAINT_CODE
  );
}
