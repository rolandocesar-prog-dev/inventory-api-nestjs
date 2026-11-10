import request from 'supertest';
import { OPERATOR, createTestApp, type TestApp } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

describe('Autenticación (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const login = (email: string, password: string) =>
    http().post('/api/v1/auth/login').send({ email, password });

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

  it('login con credenciales válidas devuelve el par de tokens (sin distinguir mayúsculas)', async () => {
    const res = await login(
      OPERATOR.email.toUpperCase(),
      OPERATOR.password,
    ).expect(200);

    expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expect(res.body.refreshToken).toMatch(/^[0-9a-f-]{36}\.[\w-]{43}$/);
  });

  it('responde 401 con el mismo mensaje si el correo no existe o la contraseña es incorrecta', async () => {
    const wrongPassword = await login(
      OPERATOR.email,
      'otra-clave-larga',
    ).expect(401);
    const unknownEmail = await login(
      'nadie@inventario.test',
      'otra-clave-larga',
    ).expect(401);

    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('responde 401 si el usuario está desactivado', async () => {
    await t.prisma.user.update({
      where: { email: OPERATOR.email },
      data: { active: false },
    });

    await login(OPERATOR.email, OPERATOR.password).expect(401);
  });

  it('responde 400 si el cuerpo es inválido o trae campos de más', async () => {
    await login('no-es-un-correo', 'x').expect(400);
    await http()
      .post('/api/v1/auth/login')
      .send({
        email: OPERATOR.email,
        password: OPERATOR.password,
        role: 'ADMIN',
      })
      .expect(400);
  });

  it('refresh rota el token: el nuevo sirve y el usado ya no', async () => {
    const first = (await login(OPERATOR.email, OPERATOR.password)).body
      .refreshToken;

    const rotated = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);
    const second = rotated.body.refreshToken;
    expect(second).not.toBe(first);

    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second })
      .expect(200);
  });

  it('reutilizar un token ya usado revoca todas las sesiones del usuario', async () => {
    const first = (await login(OPERATOR.email, OPERATOR.password)).body
      .refreshToken;
    const otherSession = (await login(OPERATOR.email, OPERATOR.password)).body
      .refreshToken;
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(200);

    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first })
      .expect(401);

    // La otra sesión también quedó revocada.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: otherSession })
      .expect(401);
  });

  it('dos renovaciones simultáneas con el mismo token: solo una gana', async () => {
    const token = (await login(OPERATOR.email, OPERATOR.password)).body
      .refreshToken;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        http().post('/api/v1/auth/refresh').send({ refreshToken: token }),
      ),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('logout revoca el token de renovación y responde 204 aunque no exista', async () => {
    const token = (await login(OPERATOR.email, OPERATOR.password)).body
      .refreshToken;

    await http()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: token })
      .expect(204);
    await http()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'basura' })
      .expect(204);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: token })
      .expect(401);
  });

  it('el token de renovación se guarda solo como hash', async () => {
    const token: string = (await login(OPERATOR.email, OPERATOR.password)).body
      .refreshToken;
    const [id, secret] = token.split('.');

    const row = await t.prisma.refreshToken.findUniqueOrThrow({
      where: { id },
    });
    expect(row.tokenHash).not.toContain(secret);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
