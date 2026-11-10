import { setTimeout as sleep } from 'node:timers/promises';
import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

/**
 * RF-03: con operaciones simultáneas el stock final es correcto y nunca
 * negativo. Las peticiones salen todas a la vez contra PostgreSQL real.
 */
describe('Concurrencia del stock (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  let productId: string;
  const http = () => request(t.app.getHttpServer());
  const move = (path: 'in' | 'out', quantity: number) =>
    http()
      .post(`/api/v1/stock/${path}`)
      .auth(tokens.operator, { type: 'bearer' })
      .send({ productId, quantity });
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
    await move('in', 10).expect(201);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('20 salidas simultáneas de 1 con stock 10: salen exactamente 10 y el stock queda en 0', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => move('out', 1)),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(10);
    expect(statuses.filter((s) => s === 422)).toHaveLength(10);
    expect(await stock()).toBe(0);

    // Cada salida vio un stock distinto: no hubo dos que leyeran el mismo valor.
    const after = results
      .filter((r) => r.status === 201)
      .map((r) => r.body.stockAfter as number)
      .sort((a, b) => a - b);
    expect(after).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('entradas y salidas mezcladas: el stock final coincide con la suma de movimientos', async () => {
    const ops = [
      ...Array.from({ length: 15 }, () => move('out', 2)),
      ...Array.from({ length: 10 }, () => move('in', 1)),
    ];
    const results = await Promise.all(ops);

    expect(results.every((r) => r.status === 201 || r.status === 422)).toBe(
      true,
    );
    const finalStock = await stock();
    expect(finalStock).toBeGreaterThanOrEqual(0);
    const { _sum } = await t.prisma.stockMovement.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    expect(_sum.quantity).toBe(finalStock);
  });

  it('control: leer y luego escribir (sin la sentencia condicional) pierde actualizaciones', async () => {
    // Implementación ingenua a propósito, solo para mostrar el problema que evita el diseño.
    const naiveOut = async () => {
      const { stock: current } = await t.prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      await sleep(20); // ventana en la que otra petición lee el mismo valor
      if (current >= 1) {
        await t.prisma.product.update({
          where: { id: productId },
          data: { stock: current - 1 },
        });
        return true;
      }
      return false;
    };

    const sold = (
      await Promise.all(Array.from({ length: 20 }, naiveOut))
    ).filter(Boolean);

    // Todas "vendieron", pero el stock solo bajó una vez: actualizaciones perdidas.
    expect(sold.length).toBeGreaterThan(10);
    expect(await stock()).toBeGreaterThan(0);
  });
});
