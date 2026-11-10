import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MovementType, type Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface MovementInput {
  productId: string;
  quantity: number;
  reason?: string;
}

export interface AdjustmentInput {
  productId: string;
  countedStock: number;
  reason: string;
}

export const movementInclude = {
  user: { select: { id: true, email: true } },
} as const satisfies Prisma.StockMovementInclude;

export type MovementView = Prisma.StockMovementGetPayload<{
  include: typeof movementInclude;
}>;

type Tx = Prisma.TransactionClient;

/**
 * Movimientos de stock (RF-03). Cada operación actualiza el stock y guarda el
 * movimiento en la misma transacción. El stock nunca queda negativo aunque
 * haya operaciones simultáneas: la salida es una sola sentencia condicional
 * (specs/design.md §3) y la base tiene `CHECK (stock >= 0)`.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  registerIn(userId: string, input: MovementInput): Promise<MovementView> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ stock: number }[]>`
        UPDATE products SET stock = stock + ${input.quantity}, updated_at = now()
        WHERE id = ${input.productId}::uuid AND active
        RETURNING stock`;
      const stockAfter =
        rows[0]?.stock ?? (await this.failure(tx, input.productId));
      return this.record(
        tx,
        userId,
        MovementType.IN,
        input,
        input.quantity,
        stockAfter,
      );
    });
  }

  registerOut(userId: string, input: MovementInput): Promise<MovementView> {
    return this.prisma.$transaction(async (tx) => {
      // La condición y la resta van en la misma sentencia: dos salidas
      // simultáneas no pueden dejar el stock negativo.
      const rows = await tx.$queryRaw<{ stock: number }[]>`
        UPDATE products SET stock = stock - ${input.quantity}, updated_at = now()
        WHERE id = ${input.productId}::uuid AND active AND stock >= ${input.quantity}
        RETURNING stock`;
      const stockAfter =
        rows[0]?.stock ??
        (await this.failure(tx, input.productId, input.quantity));
      return this.record(
        tx,
        userId,
        MovementType.OUT,
        input,
        -input.quantity,
        stockAfter,
      );
    });
  }

  /** Conteo físico: fija el stock contado y registra la diferencia. */
  adjust(userId: string, input: AdjustmentInput): Promise<MovementView> {
    return this.prisma.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<
        { stock: number; active: boolean }[]
      >`
        SELECT stock, active FROM products
        WHERE id = ${input.productId}::uuid
        FOR UPDATE`;
      if (!current) throw new NotFoundException('Producto no encontrado');
      if (!current.active) throw inactiveProduct();

      const delta = input.countedStock - current.stock;
      if (delta === 0) {
        throw new UnprocessableEntityException(
          'El stock contado es igual al actual: no hay nada que ajustar',
        );
      }
      await tx.$executeRaw`
        UPDATE products SET stock = ${input.countedStock}, updated_at = now()
        WHERE id = ${input.productId}::uuid`;
      return this.record(
        tx,
        userId,
        MovementType.ADJUSTMENT,
        input,
        delta,
        input.countedStock,
      );
    });
  }

  private record(
    tx: Tx,
    userId: string,
    type: MovementType,
    { productId, reason }: { productId: string; reason?: string },
    quantity: number,
    stockAfter: number,
  ): Promise<MovementView> {
    return tx.stockMovement.create({
      data: { productId, userId, type, quantity, stockAfter, reason },
      include: movementInclude,
    });
  }

  /** Explica por qué la actualización no afectó filas y lanza el error HTTP. */
  private async failure(
    tx: Tx,
    productId: string,
    requested?: number,
  ): Promise<never> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { active: true, stock: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (!product.active) throw inactiveProduct();
    throw new UnprocessableEntityException(
      `Stock insuficiente: hay ${product.stock} y se pidieron ${requested ?? 0}`,
    );
  }
}

function inactiveProduct(): UnprocessableEntityException {
  return new UnprocessableEntityException(
    'El producto está desactivado: no admite movimientos',
  );
}
