import request from 'supertest';
import type { TestApp } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

const OPERATOR_USER = {
  email: 'operador@inventario.test',
  password: 'clave-operador-segura',
};

describe('Límite de intentos en el login (e2e, RNF-02 y RNF-08)', () => {
  let t: TestApp;
  const previous = {
    limit: process.env['LOGIN_THROTTLE_LIMIT'],
    trustProxy: process.env['TRUST_PROXY'],
  };
  const http = () => request(t.app.getHttpServer());
  /** Intento de login como si viniera de `ip` a través del proxy de la plataforma. */
  const loginFrom = (ip: string, password: string) =>
    http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: OPERATOR_USER.email, password });

  beforeAll(async () => {
    // El valor real de producción, detrás de un proxy como en Render.
    // ConfigModule lee el entorno al importarse: la app se importa después.
    process.env['LOGIN_THROTTLE_LIMIT'] = '5';
    process.env['TRUST_PROXY'] = 'true';
    const { createTestApp } = await import('./utils/app.js');
    t = await createTestApp();
    await resetDatabase(t.prisma);
    await t.users.create(OPERATOR_USER);
  });

  afterAll(async () => {
    process.env['LOGIN_THROTTLE_LIMIT'] = previous.limit;
    process.env['TRUST_PROXY'] = previous.trustProxy;
    await t.app.close();
  });

  it('después de 5 intentos en un minuto responde 429, incluso con la clave correcta', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (await loginFrom('203.0.113.7', 'clave-equivocada')).status,
      );
    }

    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    const blocked = await loginFrom(
      '203.0.113.7',
      OPERATOR_USER.password,
    ).expect(429);
    // El throttler con nombre informa la espera en Retry-After-login.
    expect(Number(blocked.headers['retry-after-login'])).toBeGreaterThan(0);

    // El límite es solo del login: las demás rutas siguen respondiendo.
    await http().get('/health').expect(200);
  });

  it('detrás del proxy cuenta por la IP real: otro cliente no queda bloqueado', async () => {
    await loginFrom('198.51.100.20', OPERATOR_USER.password).expect(200);
  });
});
