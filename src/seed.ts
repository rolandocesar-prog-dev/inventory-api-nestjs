import { PrismaPg } from '@prisma/adapter-pg';
import { seedDemo } from './demo/seed-demo.js';
import { PrismaClient } from './generated/prisma/client.js';
import { PasswordHasher } from './users/password-hasher.js';
import { seedAdmin } from './users/seed-admin.js';

/**
 * Semilla: crea o actualiza el admin (ADMIN_EMAIL, ADMIN_PASSWORD) y, si se
 * definen DEMO_EMAIL y DEMO_PASSWORD, el operador de demostración con el
 * catálogo de ejemplo. Uso: `npm run seed` o el servicio `migrate` de Docker.
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
const hasher = new PasswordHasher();
try {
  const admin = await seedAdmin(prisma, hasher, {
    email: process.env['ADMIN_EMAIL'],
    password: process.env['ADMIN_PASSWORD'],
  });
  console.log(
    {
      skipped:
        'Semilla omitida: define ADMIN_EMAIL y ADMIN_PASSWORD para crear el admin.',
      created: 'Admin creado.',
      updated: 'Admin existente actualizado (rol, estado y contraseña).',
    }[admin],
  );

  const demo = await seedDemo(prisma, hasher, {
    email: process.env['DEMO_EMAIL'],
    password: process.env['DEMO_PASSWORD'],
  });
  if (demo.operator === 'skipped') {
    console.log('Demo omitida: define DEMO_EMAIL y DEMO_PASSWORD.');
  } else {
    console.log(
      `Operador de demo ${demo.operator === 'created' ? 'creado' : 'actualizado'}; ` +
        `productos de ejemplo cargados: ${demo.products}.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
