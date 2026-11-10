import { Role } from '../generated/prisma/client.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { PasswordHasher } from './password-hasher.js';
import { normalizeEmail } from './users.service.js';

export type SeedResult = 'skipped' | 'created' | 'updated';

export interface SeedAdminInput {
  email?: string;
  password?: string;
}

/**
 * Crea el admin inicial o, si ya existe, lo reactiva con rol admin y la
 * contraseña indicada (sirve para recuperar el acceso). Sin datos, no hace nada.
 */
export async function seedAdmin(
  prisma: Pick<PrismaClient, 'user'>,
  hasher: Pick<PasswordHasher, 'hash'>,
  { email, password }: SeedAdminInput,
): Promise<SeedResult> {
  if (!email || !password) return 'skipped';
  if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres');
  }

  const normalized = normalizeEmail(email);
  const passwordHash = await hasher.hash(password);
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });

  await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, passwordHash, role: Role.ADMIN },
    update: { passwordHash, role: Role.ADMIN, active: true },
  });
  return existing ? 'updated' : 'created';
}
