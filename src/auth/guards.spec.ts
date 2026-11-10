import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { Role } from '../generated/prisma/client.js';
import type { UsersService } from '../users/users.service.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators.js';
import { extractBearerToken, JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(
  request: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): { context: ExecutionContext; reflector: Reflector } {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) {
    Reflect.defineMetadata(key, value, handler);
  }
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, reflector: new Reflector() };
}

const activeUser = {
  id: 'u1',
  email: 'ana@tienda.com',
  role: Role.OPERATOR,
  active: true,
  createdAt: new Date(),
};

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    [undefined, null],
    ['Basic abc', null],
    ['Bearer', null],
    ['Bearer a b', null],
  ])('%s → %s', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });
});

describe('JwtAuthGuard', () => {
  const verifyAsync = vi.fn();
  const findById = vi.fn();
  const jwt = { verifyAsync } as unknown as JwtService;
  const users = { findById } as unknown as UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deja pasar las rutas públicas sin token', async () => {
    const { context, reflector } = contextFor(
      { headers: {} },
      { [IS_PUBLIC_KEY]: true },
    );

    await expect(
      new JwtAuthGuard(reflector, jwt, users).canActivate(context),
    ).resolves.toBe(true);
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('responde 401 si falta el token', async () => {
    const { context, reflector } = contextFor({ headers: {} });

    await expect(
      new JwtAuthGuard(reflector, jwt, users).canActivate(context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('responde 401 si el token es inválido o expiró', async () => {
    verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { context, reflector } = contextFor({
      headers: { authorization: 'Bearer x' },
    });

    await expect(
      new JwtAuthGuard(reflector, jwt, users).canActivate(context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('responde 401 si el usuario ya no existe o está desactivado', async () => {
    verifyAsync.mockResolvedValue({ sub: 'u1', role: Role.OPERATOR });
    const { context, reflector } = contextFor({
      headers: { authorization: 'Bearer x' },
    });
    const guard = new JwtAuthGuard(reflector, jwt, users);

    findById.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    findById.mockResolvedValue({ ...activeUser, active: false });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('deja el usuario de la base en la petición', async () => {
    verifyAsync.mockResolvedValue({ sub: 'u1', role: Role.ADMIN });
    findById.mockResolvedValue(activeUser);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer x' },
    };
    const { context, reflector } = contextFor(request);

    await expect(
      new JwtAuthGuard(reflector, jwt, users).canActivate(context),
    ).resolves.toBe(true);
    // El rol sale de la base, no del token: un cambio de rol tiene efecto inmediato.
    expect(request['user']).toEqual(activeUser);
  });
});

describe('RolesGuard', () => {
  it('deja pasar si la ruta no exige rol', () => {
    const { context, reflector } = contextFor({ user: activeUser });

    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('deja pasar si el rol coincide', () => {
    const { context, reflector } = contextFor(
      { user: { ...activeUser, role: Role.ADMIN } },
      { [ROLES_KEY]: [Role.ADMIN] },
    );

    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('responde 403 si el rol no está permitido', () => {
    const { context, reflector } = contextFor(
      { user: activeUser },
      { [ROLES_KEY]: [Role.ADMIN] },
    );

    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
