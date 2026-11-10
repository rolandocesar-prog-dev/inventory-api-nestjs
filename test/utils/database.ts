import type { PrismaService } from '../../src/prisma/prisma.service.js';

/** Vacía todas las tablas de negocio de la base de pruebas. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE stock_movements, products, categories, refresh_tokens, users RESTART IDENTITY CASCADE',
  );
}
