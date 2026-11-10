import { execSync } from 'node:child_process';

/**
 * Aplica las migraciones a la base de pruebas antes de correr los archivos e2e.
 * La URL la fija vitest.config.e2e.ts a partir de TEST_DATABASE_URL.
 */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env['TEST_DATABASE_URL'] },
  });
}
