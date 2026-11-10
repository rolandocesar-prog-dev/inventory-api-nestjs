import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';

describe('X-Request-ID (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('genera un id por petición y lo devuelve en la cabecera', async () => {
    const a = await http().get('/health').expect(200);
    const b = await http().get('/health').expect(200);

    expect(a.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
    expect(a.headers).not.toHaveProperty('x-powered-by');
  });

  it('reutiliza el id recibido y lo incluye en los errores', async () => {
    const res = await http()
      .get('/api/v1/products')
      .set('X-Request-ID', 'pedido-42')
      .expect(401);

    expect(res.headers['x-request-id']).toBe('pedido-42');
    expect(res.body.requestId).toBe('pedido-42');
  });
});
