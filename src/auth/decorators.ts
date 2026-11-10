import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';
import type { PublicUser } from '../users/users.service.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** La ruta no exige token de acceso. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Solo los roles indicados pueden usar la ruta (403 para el resto). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

/** Usuario autenticado que dejó `JwtAuthGuard` en la petición. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
