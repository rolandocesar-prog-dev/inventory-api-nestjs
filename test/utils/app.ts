import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupApp } from '../../src/setup-app.js';
import { UsersService } from '../../src/users/users.service.js';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  users: UsersService;
}

/** Levanta la aplicación completa, configurada igual que en main.ts. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    users: app.get(UsersService),
  };
}

export const ADMIN = {
  email: 'admin@inventario.test',
  password: 'clave-admin-segura',
  role: Role.ADMIN,
} as const;

export const OPERATOR = {
  email: 'operador@inventario.test',
  password: 'clave-operador-segura',
  role: Role.OPERATOR,
} as const;
