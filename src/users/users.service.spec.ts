import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PasswordHasher } from './password-hasher.js';
import { normalizeEmail, UsersService } from './users.service.js';

describe('UsersService', () => {
  const user = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  };
  const refreshToken = { updateMany: vi.fn() };
  const prisma = {
    user,
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({ user, refreshToken }),
    ),
  } as unknown as PrismaService;
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

  it('lista los usuarios sin el hash, del más antiguo al más nuevo', async () => {
    await service.findAll();

    expect(user.findMany).toHaveBeenCalledWith({
      select: expect.not.objectContaining({ passwordHash: true }),
      orderBy: { createdAt: 'asc' },
    });
  });

  describe('update', () => {
    it('cambia el rol sin tocar las sesiones', async () => {
      user.update.mockResolvedValue({ id: '2', role: Role.ADMIN });

      await service.update('1', '2', { role: Role.ADMIN });

      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '2' },
          data: { role: Role.ADMIN },
        }),
      );
      expect(refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('al desactivar revoca las sesiones del usuario', async () => {
      user.update.mockResolvedValue({ id: '2', active: false });

      await service.update('1', '2', { active: false });

      expect(refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: '2', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it.each([
      ['desactivarse', { active: false }],
      ['quitarse el rol de admin', { role: Role.OPERATOR }],
    ])('un admin no puede %s (422)', async (_caso, changes) => {
      await expect(service.update('1', '1', changes)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(user.update).not.toHaveBeenCalled();
    });

    it('un admin sí puede reafirmar su propio rol', async () => {
      user.update.mockResolvedValue({ id: '1' });

      await expect(
        service.update('1', '1', { role: Role.ADMIN, active: true }),
      ).resolves.toEqual({ id: '1' });
    });

    it('responde 404 si el usuario no existe y propaga otros errores', async () => {
      user.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.update('1', '2', { active: true }),
      ).rejects.toBeInstanceOf(NotFoundException);

      user.update.mockRejectedValueOnce(new Error('otra cosa'));
      await expect(service.update('1', '2', { active: true })).rejects.toThrow(
        'otra cosa',
      );
    });
  });
});
