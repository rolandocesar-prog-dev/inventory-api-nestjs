import request from 'supertest';
import type { TestApp } from './utils/app.js';

const ALLOWED = 'http://localhost:8080';

describe('CORS para clientes web (e2e, RNF-09)', () => {
  let t: TestApp;
  const previous = process.env['CORS_ORIGINS'];
  const http = () => request(t.app.getHttpServer());
  const preflight = (origin: string) =>
    http()
      .options('/api/v1/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

  beforeAll(async () => {
    // ConfigModule lee el entorno al importarse: la app se importa después.
    process.env['CORS_ORIGINS'] = `${ALLOWED},https://facturas.example.com`;
    const { createTestApp } = await import('./utils/app.js');
    t = await createTestApp();
  });

  afterAll(async () => {
    if (previous === undefined) delete process.env['CORS_ORIGINS'];
    else process.env['CORS_ORIGINS'] = previous;
    await t.app.close();
  });

  it('autoriza la consulta previa de un origen configurado', async () => {
    const res = await preflight(ALLOWED).expect(204);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-headers']).toMatch(
      /Authorization/,
    );
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('expone X-Request-ID a ese origen', async () => {
    const res = await http().get('/health').set('Origin', ALLOWED).expect(200);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-expose-headers']).toMatch(
      /X-Request-ID/,
    );
  });

  it('no autoriza a un origen que no está en la lista', async () => {
    const res = await preflight('https://otro-sitio.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
