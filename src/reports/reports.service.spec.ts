import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from './reports.service.js';

const product = (name: string, stock: number, minStock: number) => ({
  id: name,
  sku: name.toUpperCase(),
  name,
  categoryId: 'c1',
  category: { id: 'c1', name: 'Herramientas' },
  price: new Prisma.Decimal('10'),
  stock,
  minStock,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ReportsService', () => {
  const findMany = vi.fn();
  const queryRaw = vi.fn();
  const minStockField = { name: 'minStock' };
  const service = new ReportsService({
    product: { findMany, fields: { minStock: minStockField } },
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stock bajo: compara stock con la columna minStock y ordena por faltante', async () => {
    findMany.mockResolvedValue([
      product('clavos', 4, 5),
      product('brocha', 0, 3),
      product('alicate', 2, 3),
    ]);

    const items = await service.lowStock();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, stock: { lte: minStockField } },
      }),
    );
    expect(items.map((i) => [i.name, i.missing])).toEqual([
      ['brocha', 3],
      ['alicate', 1],
      ['clavos', 1],
    ]);
    expect(items[0]?.price).toBe('10.00');
  });

  it('valorización: suma exacta en decimal y totales por categoría', async () => {
    queryRaw.mockResolvedValue([
      {
        category_id: 'c1',
        name: 'Herramientas',
        products: 2n,
        units: 30n,
        value: new Prisma.Decimal('0.10'),
      },
      {
        category_id: 'c2',
        name: 'Pinturas',
        products: 1n,
        units: 5n,
        value: new Prisma.Decimal('0.20'),
      },
    ]);

    const report = await service.inventoryValue();

    expect(report).toEqual({
      totalValue: '0.30',
      totalUnits: 35,
      products: 3,
      byCategory: [
        {
          categoryId: 'c1',
          name: 'Herramientas',
          products: 2,
          units: 30,
          value: '0.10',
        },
        {
          categoryId: 'c2',
          name: 'Pinturas',
          products: 1,
          units: 5,
          value: '0.20',
        },
      ],
    });
  });

  it('valorización de un inventario vacío', async () => {
    queryRaw.mockResolvedValue([]);

    await expect(service.inventoryValue()).resolves.toEqual({
      totalValue: '0.00',
      totalUnits: 0,
      products: 0,
      byCategory: [],
    });
  });
});
