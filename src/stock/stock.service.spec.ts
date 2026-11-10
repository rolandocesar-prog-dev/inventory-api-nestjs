import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MovementType } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from './stock.service.js';

describe('StockService', () => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    product: { findUnique: vi.fn() },
    stockMovement: {
      create: vi.fn(async ({ data }: { data: unknown }) => data),
    },
  };
  const prisma = {
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  const service = new StockService(prisma);
  const input = { productId: 'p1', quantity: 3, reason: 'Venta' };
  /** Texto de la sentencia SQL de la llamada n a $queryRaw (con ? en los parámetros). */
  const sqlOf = (n: number) =>
    ((tx.$queryRaw.mock.calls[n]?.[0] ?? []) as string[]).join('?');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('una entrada suma y guarda el movimiento con cantidad positiva', async () => {
    tx.$queryRaw.mockResolvedValue([{ stock: 13 }]);

    const movement = await service.registerIn('u1', input);

    expect(movement).toMatchObject({
      productId: 'p1',
      userId: 'u1',
      type: MovementType.IN,
      quantity: 3,
      stockAfter: 13,
      reason: 'Venta',
    });
  });

  it('una salida resta y guarda la cantidad negativa', async () => {
    tx.$queryRaw.mockResolvedValue([{ stock: 7 }]);

    const movement = await service.registerOut('u1', input);

    expect(movement).toMatchObject({
      type: MovementType.OUT,
      quantity: -3,
      stockAfter: 7,
    });
    // La sentencia lleva la condición de stock suficiente.
    const sql = sqlOf(0);
    expect(sql).toMatch(/stock >= \?/);
  });

  it('si la salida no afecta filas por falta de stock responde 422 sin guardar nada', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    tx.product.findUnique.mockResolvedValue({ active: true, stock: 2 });

    await expect(service.registerOut('u1', input)).rejects.toThrow(
      'Stock insuficiente: hay 2 y se pidieron 3',
    );
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it.each([
    ['no existe', null, NotFoundException],
    [
      'está desactivado',
      { active: false, stock: 10 },
      UnprocessableEntityException,
    ],
  ])(
    'si el producto %s responde con el error que corresponde',
    async (_c, product, type) => {
      tx.$queryRaw.mockResolvedValue([]);
      tx.product.findUnique.mockResolvedValue(product);

      await expect(service.registerIn('u1', input)).rejects.toBeInstanceOf(
        type,
      );
      await expect(service.registerOut('u1', input)).rejects.toBeInstanceOf(
        type,
      );
    },
  );

  describe('ajuste', () => {
    const adjustment = { productId: 'p1', countedStock: 8, reason: 'Conteo' };

    it('fija el stock contado y guarda la diferencia con signo', async () => {
      tx.$queryRaw.mockResolvedValue([{ stock: 10, active: true }]);

      const movement = await service.adjust('u1', adjustment);

      expect(tx.$executeRaw).toHaveBeenCalledOnce();
      expect(movement).toMatchObject({
        type: MovementType.ADJUSTMENT,
        quantity: -2,
        stockAfter: 8,
      });
      const sql = sqlOf(0);
      expect(sql).toMatch(/FOR UPDATE/);
    });

    it('responde 422 si no hay diferencia, 404 si no existe y 422 si está desactivado', async () => {
      tx.$queryRaw.mockResolvedValueOnce([{ stock: 8, active: true }]);
      await expect(service.adjust('u1', adjustment)).rejects.toThrow(
        /no hay nada que ajustar/,
      );

      tx.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.adjust('u1', adjustment)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      tx.$queryRaw.mockResolvedValueOnce([{ stock: 1, active: false }]);
      await expect(service.adjust('u1', adjustment)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
