import request from 'supertest';
import { ADMIN, OPERATOR, type TestApp } from './app.js';

export interface Tokens {
  admin: string;
  operator: string;
}

/** Crea el admin y el operador de prueba y devuelve sus tokens de acceso. */
export async function seedUsersAndLogin(t: TestApp): Promise<Tokens> {
  await t.users.create(ADMIN);
  await t.users.create(OPERATOR);
  const login = async (email: string, password: string) => {
    const res = await request(t.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  };
  return {
    admin: await login(ADMIN.email, ADMIN.password),
    operator: await login(OPERATOR.email, OPERATOR.password),
  };
}
