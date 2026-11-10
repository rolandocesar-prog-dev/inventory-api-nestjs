import { ConflictException } from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PasswordHasher } from './password-hasher.js';
import { normalizeEmail, UsersService } from './users.service.js';

describe('UsersService', () => {
  const user = {
    create: vi.fn(),
    findUnique: vi.fn(),
  };
  const prisma = { user } as unknown as PrismaService;
  const hasher = {
    hash: vi.fn(async (password: string) => `hash(${password})`),
  } as unknown as PasswordHasher;
  const service = new UsersService(prisma, hasher);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normaliza el correo', () => {
    expect(normalizeEmail('  Ana@Tienda.COM ')).toBe('ana@tienda.com');
  });

  it('crea el usuario con la contraseña en hash y rol operador por defecto', async () => {
    user.create.mockResolvedValue({ id: '1', email: 'ana@tienda.com' });

    await service.create({
      email: 'Ana@Tienda.com',
      password: 'clave-larga-1',
    });

    expect(user.create).toHaveBeenCalledWith({
      data: {
        email: 'ana@tienda.com',
        passwordHash: 'hash(clave-larga-1)',
        role: Role.OPERATOR,
      },
      select: expect.not.objectContaining({ passwordHash: true }),
    });
  });

  it('responde 409 si el correo ya existe', async () => {
    user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create({ email: 'ana@tienda.com', password: 'clave-larga-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('propaga otros errores de la base', async () => {
    user.create.mockRejectedValue(new Error('se cayó la conexión'));

    await expect(
      service.create({ email: 'ana@tienda.com', password: 'clave-larga-1' }),
    ).rejects.toThrow('se cayó la conexión');
  });

  it('busca por correo normalizado incluyendo el hash para el login', async () => {
    await service.findByEmailWithHash(' ANA@tienda.com');

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ana@tienda.com' },
    });
  });

  it('busca por id sin el hash', async () => {
    await service.findById('1');

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { id: '1' },
      select: expect.not.objectContaining({ passwordHash: true }),
    });
  });
});
