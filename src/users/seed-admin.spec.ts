import { Role } from '../generated/prisma/client.js';
import { seedAdmin } from './seed-admin.js';

describe('seedAdmin', () => {
  const user = { findUnique: vi.fn(), upsert: vi.fn() };
  const prisma = { user } as unknown as Parameters<typeof seedAdmin>[0];
  const hasher = { hash: vi.fn(async (p: string) => `hash(${p})`) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no hace nada si faltan el correo o la contraseña', async () => {
    await expect(seedAdmin(prisma, hasher, {})).resolves.toBe('skipped');
    await expect(
      seedAdmin(prisma, hasher, { email: 'a@b.test' }),
    ).resolves.toBe('skipped');
    expect(user.upsert).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña corta', async () => {
    await expect(
      seedAdmin(prisma, hasher, { email: 'a@b.test', password: 'corta' }),
    ).rejects.toThrow(/10 caracteres/);
  });

  it('crea el admin con el correo normalizado y la contraseña en hash', async () => {
    user.findUnique.mockResolvedValue(null);

    const result = await seedAdmin(prisma, hasher, {
      email: ' Admin@Tienda.test ',
      password: 'una-clave-larga',
    });

    expect(result).toBe('created');
    expect(user.upsert).toHaveBeenCalledWith({
      where: { email: 'admin@tienda.test' },
      create: {
        email: 'admin@tienda.test',
        passwordHash: 'hash(una-clave-larga)',
        role: Role.ADMIN,
      },
      update: {
        passwordHash: 'hash(una-clave-larga)',
        role: Role.ADMIN,
        active: true,
      },
    });
  });

  it('informa que actualizó si el admin ya existía', async () => {
    user.findUnique.mockResolvedValue({ id: '1' });

    await expect(
      seedAdmin(prisma, hasher, {
        email: 'admin@tienda.test',
        password: 'una-clave-larga',
      }),
    ).resolves.toBe('updated');
  });
});
