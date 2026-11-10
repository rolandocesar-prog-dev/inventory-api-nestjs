import request from 'supertest';
import { ADMIN, OPERATOR, createTestApp, type TestApp } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

describe('Usuarios (e2e)', () => {
  let t: TestApp;
  let adminToken: string;
  let operatorToken: string;
  let operatorId: string;
  const http = () => request(t.app.getHttpServer());

  async function login(email: string, password: string) {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body as { accessToken: string; refreshToken: string };
  }

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await t.users.create(ADMIN);
    operatorId = (await t.users.create(OPERATOR)).id;
    adminToken = (await login(ADMIN.email, ADMIN.password)).accessToken;
    operatorToken = (await login(OPERATOR.email, OPERATOR.password))
      .accessToken;
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('un operador recibe 403 en la gestión de usuarios y sin token 401', async () => {
    await http()
      .get('/api/v1/users')
      .auth(operatorToken, { type: 'bearer' })
      .expect(403);
    await http()
      .post('/api/v1/users')
      .auth(operatorToken, { type: 'bearer' })
      .send({ email: 'nuevo@inventario.test', password: 'una-clave-larga' })
      .expect(403);
    await http().get('/api/v1/users').expect(401);
  });

  it('el admin crea un operador que luego puede iniciar sesión', async () => {
    const res = await http()
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({ email: 'Nuevo@Inventario.test', password: 'una-clave-larga' })
      .expect(201);

    expect(res.body).toMatchObject({
      email: 'nuevo@inventario.test',
      role: 'OPERATOR',
      active: true,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
    await login('nuevo@inventario.test', 'una-clave-larga');
  });

  it('responde 409 si el correo ya existe y 400 si la contraseña es corta', async () => {
    await http()
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: OPERATOR.email.toUpperCase(),
        password: 'una-clave-larga',
      })
      .expect(409);
    await http()
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({ email: 'otro@inventario.test', password: 'corta' })
      .expect(400);
  });

  it('el admin lista los usuarios sin hashes', async () => {
    const res = await http()
      .get('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);

    expect(res.body.map((u: { email: string }) => u.email)).toEqual([
      ADMIN.email,
      OPERATOR.email,
    ]);
    expect(JSON.stringify(res.body)).not.toContain('argon2');
  });

  it('el cambio de rol tiene efecto inmediato con el mismo token', async () => {
    await http()
      .patch(`/api/v1/users/${operatorId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ role: 'ADMIN' })
      .expect(200);

    await http()
      .get('/api/v1/users')
      .auth(operatorToken, { type: 'bearer' })
      .expect(200);
  });

  it('desactivar a un usuario corta su acceso y sus sesiones', async () => {
    const session = await login(OPERATOR.email, OPERATOR.password);

    await http()
      .patch(`/api/v1/users/${operatorId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ active: false })
      .expect(200);

    await http()
      .get('/api/v1/auth/me')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(401);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('el admin no puede desactivarse a sí mismo (422); id inválido 400; inexistente 404', async () => {
    const me = await http()
      .get('/api/v1/auth/me')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);

    await http()
      .patch(`/api/v1/users/${me.body.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ active: false })
      .expect(422);
    await http()
      .patch('/api/v1/users/no-es-uuid')
      .auth(adminToken, { type: 'bearer' })
      .send({ active: false })
      .expect(400);
    await http()
      .patch('/api/v1/users/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b')
      .auth(adminToken, { type: 'bearer' })
      .send({ active: false })
      .expect(404);
  });
});
