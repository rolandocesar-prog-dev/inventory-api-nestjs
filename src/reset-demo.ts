import { PrismaPg } from '@prisma/adapter-pg';
import { resetDemo } from './demo/seed-demo.js';
import { PrismaClient } from './generated/prisma/client.js';
import { PasswordHasher } from './users/password-hasher.js';

/**
 * Restablece los datos de la demo: borra movimientos, productos y categorías y
 * vuelve a cargar el catálogo de ejemplo. Exige CONFIRM_RESET_DEMO=RESTABLECER.
 * Uso: workflow manual «Restablecer demo» (o `node dist/reset-demo.js`).
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
  const { deleted, products } = await resetDemo(
    prisma,
    new PasswordHasher(),
    {
      email: process.env['DEMO_EMAIL'],
      password: process.env['DEMO_PASSWORD'],
    },
    process.env['CONFIRM_RESET_DEMO'],
  );
  console.log(
    `Demo restablecida: se borraron ${deleted.movements} movimientos, ` +
      `${deleted.products} productos y ${deleted.categories} categorías; ` +
      `se cargaron ${products} productos de ejemplo.`,
  );
} finally {
  await prisma.$disconnect();
}
