import { ConflictException, Injectable } from '@nestjs/common';
import { Role, type User } from '../generated/prisma/client.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordHasher } from './password-hasher.js';

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
}
