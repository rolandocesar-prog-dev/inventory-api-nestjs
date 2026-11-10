import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

describe('Reportes (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  const http = () => request(t.app.getHttpServer());
  const get = (path: string, token = tokens.admin) =>
    http().get(`/api/v1/reports/${path}`).auth(token, { type: 'bearer' });

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
    tokens = await seedUsersAndLogin(t);

    const category = async (name: string) =>
      (
        await t.prisma.category.create({
          data: { name, nameKey: name.toLowerCase() },
        })
      ).id;
    const tools = await category('Herramientas');
    const paints = await category('Pinturas');
    // stock directo en la base: aquí interesa el reporte, no los movimientos.
    const products = [
      {
        sku: 'MART-001',
        name: 'Martillo',
        categoryId: tools,
        price: '45.50',
        stock: 10,
        minStock: 5,
      },
      {
        sku: 'DEST-001',
        name: 'Destornillador',
        categoryId: tools,
        price: '0.10',
        stock: 3,
        minStock: 3,
      },
      {
        sku: 'PINT-001',
        name: 'Pintura',
        categoryId: paints,
        price: '0.20',
        stock: 0,
        minStock: 4,
      },
      {
        sku: 'BROC-001',
        name: 'Brocha vieja',
        categoryId: paints,
        price: '99',
        stock: 0,
        minStock: 9,
        active: false,
      },
    ];
    for (const data of products) await t.prisma.product.create({ data });
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('stock bajo: solo activos con stock ≤ mínimo, los más urgentes primero', async () => {
    const res = await get('low-stock').expect(200);

    expect(
      res.body.map((p: { sku: string; missing: number }) => [p.sku, p.missing]),
    ).toEqual([
      ['PINT-001', 4],
      ['DEST-001', 0],
    ]);
  });

  it('valorización exacta del inventario activo, por categoría', async () => {
    const res = await get('inventory-value').expect(200);

    // 45.50 × 10 + 0.10 × 3 = 455.30 ; 0.20 × 0 = 0.00 ; la inactiva no cuenta.
    expect(res.body).toEqual({
      totalValue: '455.30',
      totalUnits: 13,
      products: 3,
      byCategory: [
        expect.objectContaining({
          name: 'Herramientas',
          products: 2,
          units: 13,
          value: '455.30',
        }),
        expect.objectContaining({
          name: 'Pinturas',
          products: 1,
          units: 0,
          value: '0.00',
        }),
      ],
    });
  });

  it('el operador recibe 403', async () => {
    await get('low-stock', tokens.operator).expect(403);
    await get('inventory-value', tokens.operator).expect(403);
  });
});
