import { execSync } from 'node:child_process';
import './jest.env';

export default async function globalSetup(): Promise<void> {
  // Apply schema to the test DB. db push is fast and avoids needing a migration
  // history; e2e tests treat the DB as ephemeral.
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: process.env.E2E_VERBOSE === 'true' ? 'inherit' : 'pipe',
    env: { ...process.env },
  });
}
