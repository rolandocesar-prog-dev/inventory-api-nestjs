import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

describe('Categorías (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    tokens = await seedUsersAndLogin(t);
  });

  afterAll(async () => {
    await t.app.close();
  });

  const create = (name: string, token = tokens.admin) =>
    http()
      .post('/api/v1/categories')
      .auth(token, { type: 'bearer' })
      .send({ name });

  it('el admin crea categorías y cualquiera las lista ordenadas', async () => {
    await create('Pinturas').expect(201);
    const created = await create('  herramientas  ').expect(201);
    expect(created.body).toMatchObject({ name: 'herramientas' });

    const res = await http()
      .get('/api/v1/categories')
      .auth(tokens.operator, { type: 'bearer' })
      .expect(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      'herramientas',
      'Pinturas',
    ]);
  });

  it('responde 409 con un nombre repetido aunque cambien mayúsculas o espacios', async () => {
    await create('Material Eléctrico').expect(201);

    await create('  material   ELÉCTRICO ').expect(409);
  });

  it('el operador recibe 403 al crear o renombrar', async () => {
    const { body } = await create('Pinturas').expect(201);

    await create('Otra', tokens.operator).expect(403);
    await http()
      .patch(`/api/v1/categories/${body.id}`)
      .auth(tokens.operator, { type: 'bearer' })
      .send({ name: 'Otra' })
      .expect(403);
  });

  it('renombra; 409 si choca con otra, 404 si no existe, 400 si el nombre es inválido', async () => {
    const { body } = await create('Pinturas').expect(201);
    await create('Herramientas').expect(201);
    const rename = (id: string, name: string) =>
      http()
        .patch(`/api/v1/categories/${id}`)
        .auth(tokens.admin, { type: 'bearer' })
        .send({ name });

    await rename(body.id, 'Pinturas y barnices').expect(200);
    await rename(body.id, 'HERRAMIENTAS').expect(409);
    await rename('6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', 'Nueva').expect(404);
    await rename(body.id, '   ').expect(400);
  });
});
