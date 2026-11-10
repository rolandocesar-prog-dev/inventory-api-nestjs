import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs, pageMeta, type Paginated } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { kardexRange } from './kardex.dto.js';
import { movementInclude, type MovementView } from './stock.service.js';

export interface KardexFilters {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
}

/** Historial de movimientos de un producto (kardex, RF-04). */
@Injectable()
export class KardexService {
  constructor(private readonly prisma: PrismaService) {}

  async forProduct(
    productId: string,
    { page, pageSize, from, to }: KardexFilters,
  ): Promise<Paginated<MovementView>> {
    const createdAt = kardexRange(from, to);
    if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) {
      throw new BadRequestException('from no puede ser posterior a to');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const where = { productId, createdAt };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...pageArgs(page, pageSize),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { data: rows, meta: pageMeta(page, pageSize, total) };
  }
}
