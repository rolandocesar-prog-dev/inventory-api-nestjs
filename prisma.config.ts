import { defineConfig } from 'prisma/config';

// Carga .env si existe (en Docker y en el CI las variables llegan por el entorno).
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` no necesita conexión; las demás órdenes fallan si falta.
    url: process.env['DATABASE_URL'] ?? '',
  },
});
