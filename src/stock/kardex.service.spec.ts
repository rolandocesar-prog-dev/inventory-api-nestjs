import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { kardexRange } from './kardex.dto.js';
import { KardexService } from './kardex.service.js';

describe('kardexRange', () => {
  it('una fecha sola en to cubre el día completo', () => {
    expect(kardexRange('2026-11-01', '2026-11-30')).toEqual({
      gte: new Date('2026-11-01T00:00:00.000Z'),
      lte: new Date('2026-11-30T23:59:59.999Z'),
    });
  });

  it('respeta los instantes completos y los extremos ausentes', () => {
    expect(kardexRange(undefined, '2026-11-30T10:00:00Z')).toEqual({
      lte: new Date('2026-11-30T10:00:00Z'),
    });
    expect(kardexRange()).toEqual({});
  });
});

describe('KardexService', () => {
  const product = { findUnique: vi.fn() };
  const stockMovement = { findMany: vi.fn(), count: vi.fn() };
  const service = new KardexService({
    product,
    stockMovement,
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pagina los movimientos del producto en orden cronológico', async () => {
    product.findUnique.mockResolvedValue({ id: 'p1' });
    stockMovement.findMany.mockResolvedValue([{ id: 'm1' }]);
    stockMovement.count.mockResolvedValue(1);

    const result = await service.forProduct('p1', {
      page: 1,
      pageSize: 20,
      from: '2026-11-01',
    });

    expect(stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: 'p1',
          createdAt: { gte: new Date('2026-11-01T00:00:00.000Z') },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('responde 404 si el producto no existe y 400 si from > to', async () => {
    product.findUnique.mockResolvedValue(null);
    await expect(
      service.forProduct('p1', { page: 1, pageSize: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.forProduct('p1', {
        page: 1,
        pageSize: 20,
        from: '2026-12-01',
        to: '2026-11-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
