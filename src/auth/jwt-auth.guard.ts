import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenPayload } from './auth.service.js';
import { IS_PUBLIC_KEY, type AuthenticatedRequest } from './decorators.js';

/**
 * Guard global: exige un token de acceso válido salvo en rutas `@Public()`.
 * Carga el usuario de la base para que desactivarlo o cambiar su rol tenga
 * efecto inmediato, sin esperar a que expire el token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Falta el token de acceso');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }

    const user = await this.users.findById(payload.sub);
    if (!user?.active) {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }
    request.user = user;
    return true;
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  const [scheme, token, ...rest] = (header ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }
  return token;
}
