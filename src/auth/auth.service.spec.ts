import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PasswordHasher } from '../users/password-hasher.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import {
  formatRefreshToken,
  generateSecret,
  hashSecret,
} from './refresh-token.js';

describe('AuthService', () => {
  const refreshToken = {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const prisma = {
    refreshToken,
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ refreshToken })),
  } as unknown as PrismaService;
  const findByEmailWithHash = vi.fn();
  const users = { findByEmailWithHash } as unknown as UsersService;
  const verify = vi.fn();
  const hasher = {
    hash: vi.fn(async () => 'dummy-hash'),
    verify,
  } as unknown as PasswordHasher;
  const signAsync = vi.fn(async () => 'jwt');
  const jwt = { signAsync } as unknown as JwtService;
  const service = new AuthService(prisma, users, hasher, jwt);

  const user = {
    id: 'u1',
    email: 'ana@tienda.com',
    passwordHash: 'hash',
    role: Role.OPERATOR,
    active: true,
    createdAt: new Date(),
  };
  const tokenId = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  const secret = generateSecret();
  const token = formatRefreshToken({ id: tokenId, secret });
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: tokenId,
    userId: user.id,
    tokenHash: hashSecret(secret),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user,
    ...overrides,
  });

  beforeAll(async () => {
    await service.onModuleInit();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('emite un token de acceso y uno de renovación con credenciales válidas', async () => {
      findByEmailWithHash.mockResolvedValue(user);
      verify.mockResolvedValue(true);

      const pair = await service.login('ana@tienda.com', 'clave');

      expect(signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        role: Role.OPERATOR,
      });
      expect(pair).toMatchObject({
        tokenType: 'Bearer',
        accessToken: 'jwt',
        expiresIn: 900,
      });
      const [id] = pair.refreshToken.split('.');
      expect(refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ id, userId: 'u1' }),
      });
    });

    it('verifica contra un hash ficticio si el correo no existe y responde 401', async () => {
      findByEmailWithHash.mockResolvedValue(null);
      verify.mockResolvedValue(false);

      await expect(service.login('nadie@tienda.com', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(verify).toHaveBeenCalledWith('dummy-hash', 'x');
    });

    it('responde 401 con contraseña incorrecta o usuario desactivado', async () => {
      findByEmailWithHash.mockResolvedValue(user);
      verify.mockResolvedValue(false);
      await expect(service.login(user.email, 'mala')).rejects.toThrow(
        'Correo o contraseña incorrectos',
      );

      findByEmailWithHash.mockResolvedValue({ ...user, active: false });
      verify.mockResolvedValue(true);
      await expect(service.login(user.email, 'buena')).rejects.toThrow(
        'Correo o contraseña incorrectos',
      );
      expect(refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('revoca el token usado y emite un par nuevo', async () => {
      refreshToken.findUnique.mockResolvedValue(stored());
      refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const pair = await service.refresh(token);

      expect(refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: tokenId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(pair.refreshToken).not.toBe(token);
      expect(refreshToken.create).toHaveBeenCalledOnce();
    });

    it('responde 401 si el token está mal formado sin consultar la base', async () => {
      await expect(service.refresh('basura')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ['no existe', null],
      ['el secreto no coincide', stored({ tokenHash: hashSecret('otro') })],
      ['expiró', stored({ expiresAt: new Date(Date.now() - 1) })],
      [
        'el usuario está desactivado',
        stored({ user: { ...user, active: false } }),
      ],
    ])('responde 401 si el token %s', async (_caso, row) => {
      refreshToken.findUnique.mockResolvedValue(row);

      await expect(service.refresh(token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshToken.create).not.toHaveBeenCalled();
    });

    it('si el token ya fue usado, revoca todas las sesiones del usuario', async () => {
      refreshToken.findUnique.mockResolvedValue(
        stored({ revokedAt: new Date() }),
      );
      refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.refresh(token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('si otra petición rotó el token al mismo tiempo, responde 401', async () => {
      refreshToken.findUnique.mockResolvedValue(stored());
      refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh(token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revoca el token válido', async () => {
      refreshToken.findUnique.mockResolvedValue(stored());

      await service.logout(token);

      expect(refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: tokenId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('no hace nada con un token mal formado, inexistente o ajeno', async () => {
      await service.logout('basura');
      refreshToken.findUnique.mockResolvedValue(null);
      await service.logout(token);
      refreshToken.findUnique.mockResolvedValue(
        stored({ tokenHash: hashSecret('otro') }),
      );
      await service.logout(token);

      expect(refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
