import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { PasswordHasher } from './users/password-hasher.js';
import { seedAdmin } from './users/seed-admin.js';

/**
 * Semilla: crea o actualiza el admin con ADMIN_EMAIL y ADMIN_PASSWORD.
 * Uso: `npm run seed` (o el servicio `migrate` de docker compose).
 */
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('Falta DATABASE_URL');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
try {
  const result = await seedAdmin(prisma, new PasswordHasher(), {
    email: process.env['ADMIN_EMAIL'],
    password: process.env['ADMIN_PASSWORD'],
  });
  const messages = {
    skipped:
      'Semilla omitida: define ADMIN_EMAIL y ADMIN_PASSWORD para crear el admin.',
    created: 'Admin creado.',
    updated: 'Admin existente actualizado (rol, estado y contraseña).',
  };
  console.log(messages[result]);
} finally {
  await prisma.$disconnect();
}
