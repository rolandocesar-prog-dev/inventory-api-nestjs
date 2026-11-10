import request from 'supertest';
import type { TestApp } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

const OPERATOR_USER = {
  email: 'operador@inventario.test',
  password: 'clave-operador-segura',
};
describe('Límite de intentos en el login (e2e, RNF-02)', () => {
  let t: TestApp;
  const previous = process.env['LOGIN_THROTTLE_LIMIT'];

  beforeAll(async () => {
    // El valor real de producción; el resto de las pruebas e2e usa uno alto.
    // ConfigModule lee el entorno al importarse: la app se importa después.
    process.env['LOGIN_THROTTLE_LIMIT'] = '5';
    const { createTestApp } = await import('./utils/app.js');
    t = await createTestApp();
    await resetDatabase(t.prisma);
    await t.users.create(OPERATOR_USER);
  });

  afterAll(async () => {
    process.env['LOGIN_THROTTLE_LIMIT'] = previous;
    await t.app.close();
  });

  it('después de 5 intentos en un minuto responde 429, incluso con la clave correcta', async () => {
    const http = () => request(t.app.getHttpServer());
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ email: OPERATOR_USER.email, password: 'clave-equivocada' });
      statuses.push(res.status);
    }

    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    const blocked = await http()
      .post('/api/v1/auth/login')
      .send({ email: OPERATOR_USER.email, password: OPERATOR_USER.password })
      .expect(429);
    // El throttler con nombre informa la espera en Retry-After-login.
    expect(Number(blocked.headers['retry-after-login'])).toBeGreaterThan(0);

    // El límite es solo del login: las demás rutas siguen respondiendo.
    await http().get('/health').expect(200);
  });
});
