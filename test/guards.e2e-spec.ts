import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { OPERATOR, createTestApp, type TestApp } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

describe('Guards de JWT (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  async function accessToken(): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: OPERATOR.email, password: OPERATOR.password })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await t.users.create(OPERATOR);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('GET /auth/me devuelve el usuario autenticado sin el hash', async () => {
    const token = await accessToken();
    const res = await http()
      .get('/api/v1/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(res.body).toMatchObject({
      email: OPERATOR.email,
      role: 'OPERATOR',
      active: true,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('responde 401 sin token, con un token falso o firmado con otra clave', async () => {
    await http().get('/api/v1/auth/me').expect(401);
    await http()
      .get('/api/v1/auth/me')
      .auth('no-es-un-jwt', { type: 'bearer' })
      .expect(401);

    const forged = await new JwtService({
      secret: 'otra-clave-de-al-menos-32-caracteres!!',
    }).signAsync({
      sub: 'x',
      role: 'ADMIN',
    });
    await http()
      .get('/api/v1/auth/me')
      .auth(forged, { type: 'bearer' })
      .expect(401);
  });

  it('responde 401 con un token expirado', async () => {
    const expired = await t.app
      .get(JwtService)
      .signAsync({ sub: 'x', role: 'OPERATOR' }, { expiresIn: -10 });

    await http()
      .get('/api/v1/auth/me')
      .auth(expired, { type: 'bearer' })
      .expect(401);
  });

  it('un usuario desactivado pierde el acceso aunque su token no haya expirado', async () => {
    const token = await accessToken();
    await t.prisma.user.update({
      where: { email: OPERATOR.email },
      data: { active: false },
    });

    await http()
      .get('/api/v1/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(401);
  });

  it('/health y /docs siguen siendo públicos', async () => {
    await http().get('/health').expect(200);
    await http().get('/docs-json').expect(200);
  });
});
