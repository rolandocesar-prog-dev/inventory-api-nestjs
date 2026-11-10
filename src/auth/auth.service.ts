import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Role, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordHasher } from '../users/password-hasher.js';
import { UsersService } from '../users/users.service.js';
import {
  formatRefreshToken,
  generateSecret,
  hashSecret,
  parseRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  secretMatches,
} from './refresh-token.js';

/** Duración del token de acceso en segundos (15 min, RF-01). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface TokenPair {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const INVALID_SESSION = 'Sesión inválida o expirada';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  /** Hash de una contraseña al azar: se verifica cuando el correo no existe. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hasher.hash(randomBytes(32).toString('hex'));
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.users.findByEmailWithHash(email);
    // Se verifica siempre, aunque el correo no exista, para no revelarlo por el tiempo.
    const passwordOk = await this.hasher.verify(
      user?.passwordHash ?? this.dummyHash,
      password,
    );
    if (!user || !passwordOk || !user.active) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.issueTokens(user);
  }

  /** Rota el token: revoca el usado y emite un par nuevo (RF-01). */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw new UnauthorizedException(INVALID_SESSION);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });
    if (!stored || !secretMatches(parsed.secret, stored.tokenHash)) {
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (stored.revokedAt) {
      await this.revokeAllSessions(stored.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (stored.expiresAt.getTime() <= Date.now() || !stored.user.active) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    return this.prisma.$transaction(async (tx) => {
      // Condicional: si dos peticiones usan el mismo token a la vez, solo una gana.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        throw new UnauthorizedException(INVALID_SESSION);
      }
      return this.issueTokens(stored.user, tx);
    });
  }

  /** Revoca el token si es válido. No informa si existía (idempotente). */
  async logout(refreshToken: string): Promise<void> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) return;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
    });
    if (stored && secretMatches(parsed.secret, stored.tokenHash)) {
      await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.warn(
      `Reutilización de un token de renovación: ${count} sesiones revocadas del usuario ${userId}`,
    );
  }

  private async issueTokens(
    user: Pick<User, 'id' | 'role'>,
    tx: Pick<PrismaService, 'refreshToken'> = this.prisma,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const id = randomUUID();
    const secret = generateSecret();

    await tx.refreshToken.create({
      data: {
        id,
        userId: user.id,
        tokenHash: hashSecret(secret),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      tokenType: 'Bearer',
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: formatRefreshToken({ id, secret }),
    };
  }
}
