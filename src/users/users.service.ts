import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role, type User } from '../generated/prisma/client.js';
import { isNotFound, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordHasher } from './password-hasher.js';

export interface UserChanges {
  role?: Role;
  active?: boolean;
}

export interface NewUser {
  email: string;
  password: string;
  role?: Role;
}

/** Usuario sin datos sensibles, tal como lo ve la API. */
export type PublicUser = Omit<User, 'passwordHash'>;

const publicFields = {
  id: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

/** Correos sin distinguir mayúsculas ni espacios, para que sean únicos de verdad. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
  ) {}

  async create({
    email,
    password,
    role = Role.OPERATOR,
  }: NewUser): Promise<PublicUser> {
    const passwordHash = await this.hasher.hash(password);
    try {
      return await this.prisma.user.create({
        data: { email: normalizeEmail(email), passwordHash, role },
        select: publicFields,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw error;
    }
  }

  /** Incluye el hash: solo para el login. */
  findByEmailWithHash(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: publicFields });
  }

  findAll(): Promise<PublicUser[]> {
    return this.prisma.user.findMany({
      select: publicFields,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Cambia el rol o desactiva a un usuario. Desactivar revoca sus sesiones en
   * la misma transacción. Un admin no puede desactivarse ni quitarse el rol.
   */
  async update(
    actorId: string,
    id: string,
    changes: UserChanges,
  ): Promise<PublicUser> {
    if (
      actorId === id &&
      (changes.active === false ||
        (changes.role !== undefined && changes.role !== Role.ADMIN))
    ) {
      throw new UnprocessableEntityException(
        'No puedes desactivarte ni quitarte el rol de admin',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: changes,
          select: publicFields,
        });
        if (changes.active === false) {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return user;
      });
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw error;
    }
  }
}
