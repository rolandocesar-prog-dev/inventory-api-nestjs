import { defineConfig } from 'vitest/config';

// En local, TEST_DATABASE_URL viene de .env; en el CI, del entorno del job.
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (!testDatabaseUrl) {
  throw new Error(
    'Define TEST_DATABASE_URL (ver .env.example) para correr las pruebas e2e.',
  );
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // Igual que en main.ts (vía @nestjs/core): los decoradores necesitan los metadatos.
    setupFiles: ['reflect-metadata'],
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Las pruebas e2e nunca tocan la base de desarrollo.
    // El límite del login se sube para que las pruebas no choquen con él;
    // test/login-throttle.e2e-spec.ts lo baja para probarlo.
    env: {
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: 'test',
      LOGIN_THROTTLE_LIMIT: '1000',
    },
    globalSetup: ['./test/global-setup.ts'],
    // Los archivos comparten la base de pruebas: se ejecutan en serie.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
