import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

describe('Errores RFC 9457 (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
    tokens = await seedUsersAndLogin(t);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('401 con problem details y Content-Type application/problem+json', async () => {
    const res = await http().get('/api/v1/products').expect(401);

    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'No autenticado',
      status: 401,
      detail: 'Falta el token de acceso',
      instance: '/api/v1/products',
    });
  });

  it('400 de validación con la lista de errores', async () => {
    const res = await http()
      .post('/api/v1/products')
      .auth(tokens.admin, { type: 'bearer' })
      .send({ sku: 'x', price: -1 })
      .expect(400);

    expect(res.body.detail).toBe('La petición tiene datos inválidos');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sku/),
        expect.stringMatching(/price/),
      ]),
    );
  });

  it('400 con JSON mal formado (no 500)', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);

    expect(res.body).toMatchObject({ status: 400, title: 'Petición inválida' });
  });

  it('404 de una ruta inexistente con el mismo formato', async () => {
    const res = await http()
      .get('/api/v1/no-existe')
      .auth(tokens.admin, { type: 'bearer' })
      .expect(404);

    expect(res.body).toMatchObject({ status: 404, title: 'No encontrado' });
  });

  it('/health conserva el formato de terminus', async () => {
    const res = await http().get('/health').expect(200);

    expect(res.body).toMatchObject({ status: 'ok' });
  });
});
