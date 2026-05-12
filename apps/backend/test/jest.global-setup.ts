import { execSync } from 'node:child_process';
import { Client } from 'pg';
import './jest.env';

export default async function globalSetup(): Promise<void> {
  // Reset to a clean public schema, then apply migrations. We use `migrate deploy`
  // (not `db push`) because hand-written SQL migrations create the pgvector
  // extension, the partial unique idempotency index and the HNSW vector index —
  // none of which live in schema.prisma.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    stdio: process.env.E2E_VERBOSE === 'true' ? 'inherit' : 'pipe',
    env: { ...process.env },
  });
}
