import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

describe('Movimientos de stock (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  let productId: string;
  const http = () => request(t.app.getHttpServer());
  const post = (path: string, body: object, token = tokens.operator) =>
    http()
      .post(`/api/v1/stock/${path}`)
      .auth(token, { type: 'bearer' })
      .send(body);
  const stock = async () =>
    (await t.prisma.product.findUniqueOrThrow({ where: { id: productId } }))
      .stock;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    tokens = await seedUsersAndLogin(t);
    const category = await t.prisma.category.create({
      data: { name: 'Herramientas', nameKey: 'herramientas' },
    });
    productId = (
      await t.prisma.product.create({
        data: {
          sku: 'MART-001',
          name: 'Martillo',
          categoryId: category.id,
          price: '45',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('el operador registra una entrada y una salida; cada movimiento guarda quién y el stock resultante', async () => {
    const entry = await post('in', {
      productId,
      quantity: 10,
      reason: 'Compra',
    }).expect(201);
    expect(entry.body).toMatchObject({
      type: 'IN',
      quantity: 10,
      stockAfter: 10,
      reason: 'Compra',
      user: { email: 'operador@inventario.test' },
    });

    const exit = await post('out', { productId, quantity: 3 }).expect(201);
    expect(exit.body).toMatchObject({
      type: 'OUT',
      quantity: -3,
      stockAfter: 7,
    });
    expect(await stock()).toBe(7);
  });

  it('una salida que dejaría el stock negativo responde 422 y no cambia nada', async () => {
    await post('in', { productId, quantity: 2 }).expect(201);

    const res = await post('out', { productId, quantity: 3 }).expect(422);

    expect(res.body.message).toMatch(/Stock insuficiente/);
    expect(await stock()).toBe(2);
    expect(await t.prisma.stockMovement.count()).toBe(1);
  });

  it('el admin ajusta por conteo físico; el operador recibe 403', async () => {
    await post('in', { productId, quantity: 10 }).expect(201);

    await post('adjustments', {
      productId,
      countedStock: 8,
      reason: 'Conteo',
    }).expect(403);
    const res = await post(
      'adjustments',
      { productId, countedStock: 8, reason: 'Conteo: 2 rotos' },
      tokens.admin,
    ).expect(201);

    expect(res.body).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: -2,
      stockAfter: 8,
    });
    expect(await stock()).toBe(8);
  });

  it('un ajuste sin diferencia o sin motivo se rechaza', async () => {
    await post(
      'adjustments',
      { productId, countedStock: 0, reason: 'x' },
      tokens.admin,
    ).expect(422);
    await post(
      'adjustments',
      { productId, countedStock: 5 },
      tokens.admin,
    ).expect(400);
    await post(
      'adjustments',
      { productId, countedStock: 5, reason: '   ' },
      tokens.admin,
    ).expect(400);
  });

  it('producto inexistente 404, desactivado 422, cantidades inválidas 400', async () => {
    await post('in', {
      productId: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
      quantity: 1,
    }).expect(404);
    await post('in', { productId, quantity: 0 }).expect(400);
    await post('out', { productId, quantity: 1.5 }).expect(400);

    await t.prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
    await post('in', { productId, quantity: 1 }).expect(422);
  });

  it('la suma de los movimientos es igual al stock', async () => {
    await post('in', { productId, quantity: 20 }).expect(201);
    await post('out', { productId, quantity: 4 }).expect(201);
    await post('out', { productId, quantity: 6 }).expect(201);
    await post(
      'adjustments',
      { productId, countedStock: 12, reason: 'Hallazgo' },
      tokens.admin,
    ).expect(201);

    const { _sum } = await t.prisma.stockMovement.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    expect(_sum.quantity).toBe(await stock());
    expect(await stock()).toBe(12);
  });

  it('exige token', async () => {
    await http()
      .post('/api/v1/stock/in')
      .send({ productId, quantity: 1 })
      .expect(401);
  });
});
