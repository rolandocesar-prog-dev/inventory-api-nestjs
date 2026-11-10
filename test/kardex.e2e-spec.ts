import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

describe('Kardex (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  let productId: string;
  const http = () => request(t.app.getHttpServer());
  const kardex = (
    query: Record<string, string | number> = {},
    id = productId,
  ) =>
    http()
      .get(`/api/v1/products/${id}/movements`)
      .query(query)
      .auth(tokens.operator, { type: 'bearer' });

  beforeAll(async () => {
    t = await createTestApp();
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
    for (const [path, quantity] of [
      ['in', 10],
      ['out', 3],
      ['out', 2],
      ['in', 5],
    ] as const) {
      await http()
        .post(`/api/v1/stock/${path}`)
        .auth(tokens.operator, { type: 'bearer' })
        .send({ productId, quantity })
        .expect(201);
    }
    // Fechas fijas para probar el rango: noviembre y diciembre de 2026.
    const rows = await t.prisma.stockMovement.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const dates = [
      '2026-11-01T10:00:00Z',
      '2026-11-15T10:00:00Z',
      '2026-11-30T20:00:00Z',
      '2026-12-02T10:00:00Z',
    ];
    for (const [i, row] of rows.entries()) {
      await t.prisma.stockMovement.update({
        where: { id: row.id },
        data: { createdAt: new Date(dates[i] ?? '') },
      });
    }
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('devuelve el historial en orden con el stock resultante de cada movimiento', async () => {
    const res = await kardex().expect(200);

    expect(
      res.body.data.map(
        (m: { type: string; quantity: number; stockAfter: number }) => [
          m.type,
          m.quantity,
          m.stockAfter,
        ],
      ),
    ).toEqual([
      ['IN', 10, 10],
      ['OUT', -3, 7],
      ['OUT', -2, 5],
      ['IN', 5, 10],
    ]);
    expect(res.body.data[0].user).toEqual({
      id: expect.any(String),
      email: 'operador@inventario.test',
    });
    expect(res.body.meta.total).toBe(4);
  });

  it('filtra por rango de fechas inclusivo (una fecha sola cubre todo el día)', async () => {
    const res = await kardex({ from: '2026-11-15', to: '2026-11-30' }).expect(
      200,
    );

    expect(
      res.body.data.map((m: { stockAfter: number }) => m.stockAfter),
    ).toEqual([7, 5]);
  });

  it('pagina', async () => {
    const res = await kardex({ page: 2, pageSize: 3 }).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ total: 4, totalPages: 2 });
  });

  it('400 con fechas inválidas o invertidas, 404 si el producto no existe', async () => {
    await kardex({ from: 'ayer' }).expect(400);
    await kardex({ from: '2026-12-01', to: '2026-11-01' }).expect(400);
    await kardex({}, '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b').expect(404);
  });
});
