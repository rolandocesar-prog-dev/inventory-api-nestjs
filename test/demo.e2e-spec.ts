import request from 'supertest';
import { DEMO_PRODUCTS, seedDemo } from '../src/demo/seed-demo.js';
import { PasswordHasher } from '../src/users/password-hasher.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

const DEMO = {
  email: 'demo@inventario.test',
  password: 'demo-inventario-2026',
};

describe('Operador de demostración (e2e)', () => {
  let t: TestApp;
  let token: string;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
    await seedDemo(t.prisma, new PasswordHasher(), DEMO);
    const res = await http().post('/api/v1/auth/login').send(DEMO).expect(200);
    token = res.body.accessToken as string;
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('carga el catálogo con stock coherente con sus movimientos', async () => {
    const res = await http()
      .get('/api/v1/products?pageSize=100')
      .auth(token, { type: 'bearer' })
      .expect(200);

    expect(res.body.meta.total).toBe(DEMO_PRODUCTS.length);
    const { _sum } = await t.prisma.stockMovement.aggregate({
      _sum: { quantity: true },
    });
    const stock = await t.prisma.product.aggregate({ _sum: { stock: true } });
    expect(_sum.quantity).toBe(stock._sum.stock);
  });

  it('el operador de demo puede registrar movimientos', async () => {
    const product = await t.prisma.product.findUniqueOrThrow({
      where: { sku: 'MART-001' },
    });

    await http()
      .post('/api/v1/stock/out')
      .auth(token, { type: 'bearer' })
      .send({
        productId: product.id,
        quantity: 1,
        reason: 'Prueba de reclutador',
      })
      .expect(201);
  });

  it('pero no gestionar usuarios, cambiar el catálogo, ajustar ni ver reportes', async () => {
    const product = await t.prisma.product.findUniqueOrThrow({
      where: { sku: 'MART-001' },
    });
    const auth = { type: 'bearer' } as const;

    await http().get('/api/v1/users').auth(token, auth).expect(403);
    await http()
      .post('/api/v1/users')
      .auth(token, auth)
      .send({ email: 'x@y.test', password: 'una-clave-larga', role: 'ADMIN' })
      .expect(403);
    await http()
      .patch(`/api/v1/products/${product.id}`)
      .auth(token, auth)
      .send({ price: 1 })
      .expect(403);
    await http()
      .post('/api/v1/stock/adjustments')
      .auth(token, auth)
      .send({ productId: product.id, countedStock: 0, reason: 'x' })
      .expect(403);
    await http()
      .get('/api/v1/reports/inventory-value')
      .auth(token, auth)
      .expect(403);
  });

  it('volver a correr la semilla no duplica el catálogo', async () => {
    const result = await seedDemo(t.prisma, new PasswordHasher(), DEMO);

    expect(result).toEqual({ operator: 'updated', products: 0 });
    expect(await t.prisma.product.count()).toBe(DEMO_PRODUCTS.length);
  });
});
