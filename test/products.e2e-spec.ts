import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

describe('Productos (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  let categoryId: string;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    tokens = await seedUsersAndLogin(t);
    const res = await http()
      .post('/api/v1/categories')
      .auth(tokens.admin, { type: 'bearer' })
      .send({ name: 'Herramientas' })
      .expect(201);
    categoryId = res.body.id;
  });

  afterAll(async () => {
    await t.app.close();
  });

  const create = (body: Record<string, unknown>, token = tokens.admin) =>
    http()
      .post('/api/v1/products')
      .auth(token, { type: 'bearer' })
      .send({ categoryId, name: 'Martillo', price: 45.5, ...body });

  it('el admin crea un producto con stock 0 y el operador lo consulta', async () => {
    const created = await create({ sku: ' mart-001 ', minStock: 5 }).expect(
      201,
    );

    expect(created.body).toMatchObject({
      sku: 'MART-001',
      price: '45.50',
      stock: 0,
      minStock: 5,
      active: true,
      category: { id: categoryId, name: 'Herramientas' },
    });

    await http()
      .get(`/api/v1/products/${created.body.id}`)
      .auth(tokens.operator, { type: 'bearer' })
      .expect(200);
  });

  it('responde 409 con un SKU repetido aunque cambien las mayúsculas', async () => {
    await create({ sku: 'MART-001' }).expect(201);

    await create({ sku: 'mart-001' }).expect(409);
  });

  it('responde 422 si la categoría no existe', async () => {
    await create({
      sku: 'MART-001',
      categoryId: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    }).expect(422);
  });

  it.each([
    ['SKU con espacios', { sku: 'MAR 001' }],
    ['precio negativo', { sku: 'MART-001', price: -1 }],
    ['precio con 3 decimales', { sku: 'MART-001', price: 1.234 }],
    ['stock en el cuerpo', { sku: 'MART-001', stock: 10 }],
  ])('responde 400 con %s', async (_caso, body) => {
    await create(body).expect(400);
  });

  it('el stock no se puede cambiar desde el catálogo', async () => {
    const { body } = await create({ sku: 'MART-001' }).expect(201);

    await http()
      .patch(`/api/v1/products/${body.id}`)
      .auth(tokens.admin, { type: 'bearer' })
      .send({ stock: 100 })
      .expect(400);
  });

  it('el admin actualiza; el operador recibe 403 al crear, editar o desactivar', async () => {
    const { body } = await create({ sku: 'MART-001' }).expect(201);

    const updated = await http()
      .patch(`/api/v1/products/${body.id}`)
      .auth(tokens.admin, { type: 'bearer' })
      .send({ name: 'Martillo 16 oz', price: 50 })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Martillo 16 oz',
      price: '50.00',
    });

    await create({ sku: 'OTRO-001' }, tokens.operator).expect(403);
    await http()
      .patch(`/api/v1/products/${body.id}`)
      .auth(tokens.operator, { type: 'bearer' })
      .send({ name: 'x' })
      .expect(403);
    await http()
      .delete(`/api/v1/products/${body.id}`)
      .auth(tokens.operator, { type: 'bearer' })
      .expect(403);
  });

  it('DELETE desactiva sin borrar y el producto se puede reactivar', async () => {
    const { body } = await create({ sku: 'MART-001' }).expect(201);

    await http()
      .delete(`/api/v1/products/${body.id}`)
      .auth(tokens.admin, { type: 'bearer' })
      .expect(204);

    const row = await t.prisma.product.findUniqueOrThrow({
      where: { id: body.id },
    });
    expect(row.active).toBe(false);

    await http()
      .patch(`/api/v1/products/${body.id}`)
      .auth(tokens.admin, { type: 'bearer' })
      .send({ active: true })
      .expect(200);
  });

  it('responde 404 con un id inexistente y 400 con uno inválido', async () => {
    await http()
      .get('/api/v1/products/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b')
      .auth(tokens.operator, { type: 'bearer' })
      .expect(404);
    await http()
      .delete('/api/v1/products/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b')
      .auth(tokens.admin, { type: 'bearer' })
      .expect(404);
    await http()
      .get('/api/v1/products/123')
      .auth(tokens.operator, { type: 'bearer' })
      .expect(400);
  });
});
